"""Descubrimiento de objetivos desde hallazgos de escaneo → inventario M2."""

from __future__ import annotations

import re
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.deps.auth import tenant_findings_filter
from app.models.core import Asset, AssetSourceType, Environment, Finding
from app.models.scan import AssetScanTarget
from app.services.finding_duplicates import _resolve_componente, normalize_affected_component

_IP_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_HOST_PORT_RE = re.compile(r"^([^:/]+)(?::(\d+))?$")


def _display_from_component(component: str) -> str:
    raw = (component or "").strip()
    if not raw:
        return ""
    m = _HOST_PORT_RE.match(raw.split("/")[0])
    if m:
        return m.group(1)
    return raw[:255]


def _asset_matches_key(asset: Asset, target_key: str, display: str) -> bool:
    key = target_key.lower()
    disp = display.lower()
    for field in (asset.nombre, asset.fqdn, asset.ip_publica, asset.ip_privada):
        if not field:
            continue
        norm = normalize_affected_component(str(field))
        if norm == key or str(field).strip().lower() == disp:
            return True
    return False


def _inventory_has_target(assets: list[Asset], target_key: str, display: str) -> bool:
    return any(_asset_matches_key(a, target_key, display) for a in assets)


def _parse_asset_fields(display: str, component: str) -> dict[str, Optional[str]]:
    host = _display_from_component(component) or display
    ip_publica = None
    fqdn = None
    if _IP_RE.match(host):
        ip_publica = host
    elif "." in host and not host.startswith("http"):
        fqdn = host
    return {"nombre": host or component[:255], "ip_publica": ip_publica, "fqdn": fqdn}


def refresh_scan_targets(
    db: Session,
    *,
    tenant_id: UUID,
    engagement_id: Optional[UUID] = None,
) -> dict[str, int]:
    query = tenant_findings_filter(db.query(Finding), tenant_id)
    if engagement_id is not None:
        query = query.filter(Finding.engagement_id == engagement_id)
    findings = query.filter(Finding.asset_id.is_(None)).all()

    buckets: dict[str, dict[str, Any]] = {}
    for finding in findings:
        component = _resolve_componente(finding)
        key = normalize_affected_component(component)
        if not key:
            continue
        display = _display_from_component(component) or key
        bucket = buckets.setdefault(
            key,
            {
                "display": display,
                "component": component or display,
                "tools": set(),
                "count": 0,
                "engagement_id": finding.engagement_id,
            },
        )
        bucket["count"] += 1
        if finding.tool_source:
            bucket["tools"].add(finding.tool_source)

    assets = db.query(Asset).filter(Asset.tenant_id == tenant_id).all()
    discovered = 0
    pending = 0

    for key, meta in buckets.items():
        if _inventory_has_target(assets, key, meta["display"]):
            continue

        row = (
            db.query(AssetScanTarget)
            .filter(AssetScanTarget.tenant_id == tenant_id, AssetScanTarget.target_key == key)
            .first()
        )
        tools = sorted(meta["tools"])

        if row:
            if row.status == "pending":
                row.display_name = meta["display"]
                row.componente_afectado = meta["component"]
                row.finding_count = meta["count"]
                row.tool_sources = tools
                if engagement_id and not row.engagement_id:
                    row.engagement_id = engagement_id
                pending += 1
            continue

        db.add(
            AssetScanTarget(
                tenant_id=tenant_id,
                engagement_id=engagement_id or meta.get("engagement_id"),
                target_key=key,
                display_name=meta["display"],
                componente_afectado=meta["component"],
                tool_sources=tools,
                finding_count=meta["count"],
                status="pending",
            )
        )
        discovered += 1
        pending += 1

    db.commit()
    total_pending = (
        db.query(AssetScanTarget)
        .filter(
            AssetScanTarget.tenant_id == tenant_id,
            AssetScanTarget.status == "pending",
        )
        .count()
    )
    return {"discovered": discovered, "pending": total_pending}


def _findings_for_target(db: Session, tenant_id: UUID, target_key: str) -> list[Finding]:
    query = tenant_findings_filter(db.query(Finding), tenant_id).filter(Finding.asset_id.is_(None))
    out: list[Finding] = []
    for finding in query.all():
        comp = normalize_affected_component(_resolve_componente(finding))
        if comp == target_key:
            out.append(finding)
    return out


def promote_scan_targets(
    db: Session,
    *,
    tenant_id: UUID,
    target_ids: list[UUID],
    source_type: AssetSourceType,
    engagement_id: Optional[UUID],
) -> dict[str, Any]:
    rows = (
        db.query(AssetScanTarget)
        .filter(
            AssetScanTarget.tenant_id == tenant_id,
            AssetScanTarget.id.in_(target_ids),
            AssetScanTarget.status == "pending",
        )
        .all()
    )
    asset_ids: list[UUID] = []
    for target in rows:
        fields = _parse_asset_fields(target.display_name, target.componente_afectado)
        tools = target.tool_sources or []
        asset = Asset(
            tenant_id=tenant_id,
            nombre=fields["nombre"] or target.display_name,
            ip_publica=fields["ip_publica"],
            fqdn=fields["fqdn"],
            ambiente=Environment.prod,
            is_in_scope=True,
            source_type=source_type,
            engagement_id=engagement_id or target.engagement_id,
            discovery_method=", ".join(tools) if tools else "Escaneo",
            extra_metadata={"from_scan_target": str(target.id), "target_key": target.target_key},
        )
        db.add(asset)
        db.flush()

        linked = 0
        for finding in _findings_for_target(db, tenant_id, target.target_key):
            finding.asset_id = asset.id
            linked += 1

        target.status = "accepted"
        target.promoted_asset_id = asset.id
        target.target_source_type = source_type.value
        asset_ids.append(asset.id)

    db.commit()
    return {"processed": len(rows), "asset_ids": asset_ids, "linked_findings": True}


def pass_scan_targets(
    db: Session,
    *,
    tenant_id: UUID,
    target_ids: list[UUID],
) -> int:
    updated = (
        db.query(AssetScanTarget)
        .filter(
            AssetScanTarget.tenant_id == tenant_id,
            AssetScanTarget.id.in_(target_ids),
            AssetScanTarget.status == "pending",
        )
        .update({AssetScanTarget.status: "passed"}, synchronize_session=False)
    )
    db.commit()
    return int(updated or 0)
