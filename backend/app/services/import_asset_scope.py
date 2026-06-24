"""Grupo / subgrupo de activos en contexto de importación."""

from __future__ import annotations


def apply_asset_scope_to_drafts(
    drafts: list[dict],
    *,
    asset_group: str | None = None,
    asset_subgroup: str | None = None,
) -> None:
    """Inyecta grupo y subgrupo en import_context de cada borrador."""
    group = (asset_group or "").strip()
    subgroup = (asset_subgroup or "").strip()
    if not group and not subgroup:
        return
    for draft in drafts:
        ctx = dict(draft.get("import_context") or {})
        if group:
            ctx["asset_group"] = group
            ctx["asset_groups"] = [group]
        if subgroup:
            ctx["asset_subgroup"] = subgroup
            ctx["asset_subgroups"] = [subgroup]
        draft["import_context"] = ctx


def asset_scope_suffix_from_ctx(ctx: dict | None) -> str:
    if not ctx:
        return ""
    group = (ctx.get("asset_group") or "").strip()
    subgroup = (ctx.get("asset_subgroup") or "").strip()
    if not group and not subgroup:
        return ""
    return f"|grp:{group}|sub:{subgroup}"
