"""Agregación de hallazgos por tipo de vulnerabilidad (server-side).

Evita descargar decenas de miles de hallazgos completos al navegador: agrupa por
clave de tipo en el servidor y devuelve solo un representante por tipo, los conteos
y los ids de los miembros. Replica `findingTypeKey` de `finding-grouping.ts` usando
tool_source / tool_vuln_id / título (sin parsear raw_tool_output, que es el campo
pesado), por lo que solo carga columnas ligeras para las decenas de miles de filas.
"""

from __future__ import annotations

from app.models.core import Finding, Severity
from app.services.catalog_tool_index import normalize_tool_source

_SEV_RANK: dict[Severity, int] = {
    Severity.critical: 0,
    Severity.high: 1,
    Severity.medium: 2,
    Severity.low: 3,
    Severity.info: 4,
}


def _type_key(tool_source, tool_vuln_id, titulo) -> str:
    vid = (tool_vuln_id or "").strip()
    if vid:
        src = normalize_tool_source(tool_source)
        if src != "manual":
            return f"tool:{src}:{vid}"
    return f"title:{(titulo or '').strip().lower()}"


def _tool_label(tool_source, tool_vuln_id) -> str:
    vid = (tool_vuln_id or "").strip()
    if vid:
        return f"{normalize_tool_source(tool_source)}:{vid}"
    return "manual"


def build_type_groups(db, base_query) -> dict:
    """Agrupa por tipo y resuelve un representante completo por grupo.

    1. Carga columnas ligeras (id, tool_source, tool_vuln_id, titulo, severidad)
       para todas las filas que cumplen el filtro — barato aunque sean 50k.
    2. Agrupa en memoria por clave de tipo, elige representante (más reciente) y
       calcula la severidad máxima del grupo.
    3. Carga los objetos Finding completos SOLO de los representantes (unos cientos).
    """
    rows = (
        base_query.with_entities(
            Finding.id,
            Finding.tool_source,
            Finding.tool_vuln_id,
            Finding.titulo,
            Finding.severidad,
        )
        .order_by(Finding.created_at.desc())
        .all()
    )

    groups: dict[str, dict] = {}
    order: list[str] = []
    for r in rows:
        key = _type_key(r.tool_source, r.tool_vuln_id, r.titulo)
        g = groups.get(key)
        if g is None:
            g = {
                "key": key,
                "rep_id": r.id,
                "titulo": (r.titulo or "").strip() or "Sin título",
                "severidad": r.severidad,
                "tool_label": _tool_label(r.tool_source, r.tool_vuln_id),
                "member_ids": [],
            }
            groups[key] = g
            order.append(key)
        g["member_ids"].append(str(r.id))
        if _SEV_RANK.get(r.severidad, 5) < _SEV_RANK.get(g["severidad"], 5):
            g["severidad"] = r.severidad

    rep_ids = [groups[k]["rep_id"] for k in order]
    reps_by_id: dict = {}
    if rep_ids:
        reps = db.query(Finding).filter(Finding.id.in_(rep_ids)).all()
        reps_by_id = {f.id: f for f in reps}

    return {
        "order": order,
        "groups": groups,
        "reps_by_id": reps_by_id,
        "total_findings": len(rows),
        "total_types": len(order),
    }
