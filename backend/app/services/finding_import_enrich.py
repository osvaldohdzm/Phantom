"""Enlaza hallazgos importados con activos del inventario (IP/host → grupos/subgrupos)."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.core import Asset, Finding
from app.services.tag_list import merge_tag_lists, parse_tag_list

_IP_RE = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")


def _extract_host_ip(componente: str | None, host: str | None) -> str | None:
    if host and host.strip():
        return host.strip().split(":")[0].strip()
    if not componente:
        return None
    c = componente.strip()
    m = _IP_RE.search(c)
    if m:
        return m.group(1)
    if ":" in c and not c.startswith("cpe:"):
        return c.split(":")[0].strip()
    return None


def _asset_metadata(asset: Asset) -> dict[str, Any]:
    return dict(asset.extra_metadata or {})


def enrich_finding_import_context(
    db: Session,
    finding: Finding,
    *,
    tenant_id: UUID | None,
) -> None:
    """Completa detection_sources con grupos/subgrupos del inventario si hay match por IP."""
    sources = [dict(s) for s in (finding.detection_sources or [])]
    if not sources:
        sources = [{"source": finding.tool_source or "universal-csv"}]

    ctx = dict(sources[0])
    host_ip = _extract_host_ip(finding.componente_afectado, ctx.get("host"))
    if not host_ip or not tenant_id:
        return

    asset = (
        db.query(Asset)
        .filter(
            Asset.tenant_id == tenant_id,
            or_(
                Asset.ip_privada == host_ip,
                Asset.ip_publica == host_ip,
                Asset.nombre == host_ip,
            ),
        )
        .first()
    )
    if not asset:
        return

    if not finding.asset_id:
        finding.asset_id = asset.id

    meta = _asset_metadata(asset)
    csv_groups = merge_tag_lists(ctx.get("asset_groups"), ctx.get("asset_group"))
    csv_subgroups = merge_tag_lists(ctx.get("asset_subgroups"), ctx.get("asset_subgroup"))
    inv_groups = parse_tag_list(meta.get("grupos_activos"))
    inv_subgroups = parse_tag_list(
        meta.get("subgrupos_activos") or meta.get("sub_grupos_activos")
    )

    groups = merge_tag_lists(csv_groups, inv_groups)
    subgroups = merge_tag_lists(csv_subgroups, inv_subgroups)

    if groups:
        ctx["asset_groups"] = groups
        ctx["asset_group"] = groups[0]
    if subgroups:
        ctx["asset_subgroups"] = subgroups
        ctx["asset_subgroup"] = subgroups[0]
    if asset.nombre and not ctx.get("host"):
        ctx["host"] = host_ip
    ctx["linked_asset_id"] = str(asset.id)
    ctx["linked_asset_name"] = asset.nombre

    sources[0] = ctx
    finding.detection_sources = sources
