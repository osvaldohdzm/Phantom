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
from app.services.vulns_catalog_lookup import build_componente_afectado

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


def _split_component(component: str) -> tuple[str, Optional[str], Optional[str]]:
    """host, port, transport from componente_afectado (host:port or host:port/proto)."""
    raw = (component or "").strip()
    if not raw:
        return "", None, None
    transport = None
    if "/" in raw:
        base, suffix = raw.split("/", 1)
        if suffix.lower() in ("tcp", "udp"):
            transport = suffix.lower()
        raw = base
    m = _HOST_PORT_RE.match(raw)
    if m:
        return m.group(1), m.group(2), transport
    return raw, None, transport


def _asset_covers_target(asset: Asset, target_key: str, component: str) -> bool:
    meta = asset.extra_metadata or {}
    stored = (meta.get("target_key") or "").strip().lower()
    if stored and stored == target_key.lower():
        return True
    host, port, _ = _split_component(component)
    if port:
        meta_port = str(meta.get("puerto") or "").strip()
        for field in (asset.ip_publica, asset.ip_privada, asset.fqdn, asset.nombre):
            if not field:
                continue
            if str(field).strip().lower() == host.lower() and meta_port == port:
                return True
    return _asset_matches_key(asset, target_key, _display_from_component(component))


def _inventory_has_target(assets: list[Asset], target_key: str, display: str, component: str) -> bool:
    return any(_asset_covers_target(a, target_key, component) for a in assets)


def _parse_asset_fields(display: str, component: str) -> dict[str, Optional[str]]:
    host = _display_from_component(component) or display
    ip_publica = None
    fqdn = None
    if _IP_RE.match(host):
        ip_publica = host
    elif "." in host and not host.startswith("http"):
        fqdn = host
    return {"nombre": host or component[:255], "ip_publica": ip_publica, "fqdn": fqdn}


def backfill_finding_componente(
    db: Session,
    tenant_id: UUID,
    *,
    batch: int = 10_000,
) -> int:
    """Rellena componente_afectado en hallazgos antiguos (p. ej. Nmap sin host:puerto)."""
    rows = (
        tenant_findings_filter(db.query(Finding), tenant_id)
        .filter(Finding.asset_id.is_(None))
        .filter(
            (Finding.componente_afectado.is_(None)) | (Finding.componente_afectado == "")
        )
        .limit(batch)
        .all()
    )
    updated = 0
    for finding in rows:
        comp = _resolve_componente(finding)
        if not comp:
            continue
        finding.componente_afectado = comp
        updated += 1
    if updated:
        db.commit()
    return updated


def refresh_scan_targets(
    db: Session,
    *,
    tenant_id: UUID,
    engagement_id: Optional[UUID] = None,
    only_keys: Optional[set[str]] = None,
) -> dict[str, int]:
    backfill_finding_componente(db, tenant_id)

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
        if only_keys is not None and key not in only_keys:
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
    reopened = 0
    pending = 0

    for key, meta in buckets.items():
        if _inventory_has_target(assets, key, meta["display"], meta["component"]):
            continue

        row = (
            db.query(AssetScanTarget)
            .filter(AssetScanTarget.tenant_id == tenant_id, AssetScanTarget.target_key == key)
            .first()
        )
        tools = sorted(meta["tools"])
        target_engagement = engagement_id or meta.get("engagement_id")

        if row:
            if row.status == "pending":
                row.display_name = meta["display"]
                row.componente_afectado = meta["component"]
                row.finding_count = meta["count"]
                merged_tools = set(row.tool_sources or [])
                merged_tools.update(meta["tools"])
                row.tool_sources = sorted(merged_tools)
                if target_engagement and not row.engagement_id:
                    row.engagement_id = target_engagement
                pending += 1
            elif row.status == "passed" and only_keys is not None:
                row.status = "pending"
                row.display_name = meta["display"]
                row.componente_afectado = meta["component"]
                row.finding_count = meta["count"]
                merged_tools = set(row.tool_sources or [])
                merged_tools.update(meta["tools"])
                row.tool_sources = sorted(merged_tools)
                row.promoted_asset_id = None
                row.target_source_type = None
                if target_engagement:
                    row.engagement_id = target_engagement
                reopened += 1
                pending += 1
            continue

        db.add(
            AssetScanTarget(
                tenant_id=tenant_id,
                engagement_id=target_engagement,
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
    return {"discovered": discovered, "reopened": reopened, "pending": total_pending}


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
        component = target.componente_afectado or target.display_name or target.target_key
        host, port, transport = _split_component(component)
        fields = _parse_asset_fields(host or target.display_name, component)
        tools = target.tool_sources or []
        internal = source_type in (
            AssetSourceType.internal_attack_surface,
            AssetSourceType.internal_recon,
        )
        meta: dict[str, str] = {
            "from_scan_target": str(target.id),
            "target_key": target.target_key,
        }
        if port:
            meta["puerto"] = port
        if transport:
            meta["transporte"] = transport

        ip = fields["ip_publica"]
        asset = Asset(
            tenant_id=tenant_id,
            nombre=fields["nombre"] or target.display_name,
            ip_publica=None if internal else ip,
            ip_privada=ip if internal else None,
            fqdn=fields["fqdn"] if not ip else None,
            ambiente=Environment.prod,
            is_in_scope=True,
            source_type=source_type,
            engagement_id=engagement_id or target.engagement_id,
            discovery_method=", ".join(tools) if tools else "Scan",
            extra_metadata=meta,
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


def upsert_assets_from_scan_drafts(
    db: Session,
    *,
    tenant_id: UUID,
    drafts: list[dict[str, Any]],
    source_type: AssetSourceType,
    engagement_id: Optional[UUID],
) -> dict[str, int]:
    """Crea/actualiza filas de inventario (p. ej. attack surface) directamente desde drafts de escaneo."""
    internal = source_type in (
        AssetSourceType.internal_attack_surface,
        AssetSourceType.internal_recon,
    )
    q = db.query(Asset).filter(
        Asset.tenant_id == tenant_id,
        Asset.source_type == source_type,
    )
    if engagement_id is not None:
        q = q.filter(Asset.engagement_id == engagement_id)
    existing = list(q.all())

    created = 0
    updated = 0
    for draft in drafts:
        comp = (draft.get("componente_afectado") or "").strip()
        if not comp:
            host = (draft.get("host") or "").strip()
            port = str(draft.get("port") or "").strip()
            proto = str(draft.get("proto") or "").strip()
            if host:
                comp = build_componente_afectado(host, port, proto) if port else host
        if not comp:
            continue
        key = normalize_affected_component(comp)
        if not key:
            continue

        host, port, transport = _split_component(comp)
        if not host:
            continue
        port = port or str(draft.get("port") or "").strip() or None
        transport = transport or str(draft.get("proto") or "").strip().lower() or None
        service = ""
        tool_id = str(draft.get("tool_vuln_id") or "")
        if "/" in tool_id:
            service = tool_id.split("/", 1)[0]

        fields = _parse_asset_fields(host, comp)
        ip = fields["ip_publica"]
        meta: dict[str, str] = {"target_key": key}
        if port:
            meta["puerto"] = port
        if transport:
            meta["transporte"] = transport
        if service:
            meta["servicio"] = service[:255]

        row = None
        for asset in existing:
            if _asset_covers_target(asset, key, comp):
                row = asset
                break

        if row:
            merged = dict(row.extra_metadata or {})
            merged.update({k: v for k, v in meta.items() if v})
            row.extra_metadata = merged
            if service and not row.discovery_method:
                row.discovery_method = draft.get("tool_source") or "Nmap"
            updated += 1
            continue

        asset = Asset(
            tenant_id=tenant_id,
            nombre=fields["nombre"] or key,
            ip_publica=None if internal else ip,
            ip_privada=ip if internal else None,
            fqdn=fields["fqdn"] if not ip else None,
            ambiente=Environment.prod,
            is_in_scope=True,
            source_type=source_type,
            engagement_id=engagement_id,
            discovery_method=str(draft.get("tool_source") or "Scan"),
            extra_metadata=meta,
        )
        db.add(asset)
        existing.append(asset)
        created += 1

    db.commit()
    return {"created": created, "updated": updated}


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
