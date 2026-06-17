"""Catálogo de campos oficiales para importación CSV universal (core + opcionales)."""

from __future__ import annotations

# Campos prioritarios — claves estables, no eliminar
CORE_FIELDS: tuple[str, ...] = (
    "title",
    "description",
    "severity",
    "component",
    "cve",
    "cwe",
    "cvss",
    "impact",
    "remediation",
    "evidence",
    "method",
    "epss",
    "kev",
)

# Campos complementarios — mismas claves estables, import opcional
OPTIONAL_FIELDS: tuple[str, ...] = (
    "hosts",
    "asset_group",
    "asset_subgroup",
    "asset_type",
    "recommendation",
    "remediation_time",
    "mitigation_type",
    "detected_date",
    "registered_date",
    "status",
    "project",
    "comments",
    "security_comments",
)

STANDARD_FIELDS: tuple[str, ...] = CORE_FIELDS + OPTIONAL_FIELDS

# Tokens que penalizan un match (evita «Tiempo de remediación» → remediación)
NEGATIVE_HEADER_TOKENS: dict[str, tuple[str, ...]] = {
    "remediation": ("tiempo", "time", "duration", "sla", "plazo", "fecha"),
    "method": ("fecha", "date", "registro"),
    "component": ("grupo", "group", "tipo", "type", "proyecto", "project", "host", "hosts"),
    "hosts": ("componente", "component", "grupo", "group", "proyecto", "project"),
    "description": ("comentario", "comment", "justificacion", "seguridad"),
}

FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "title": (
        "title", "titulo", "título", "name", "nombre", "vulnerability", "vulnerabilidad",
        "vuln name", "vulnerability name", "plugin name", "issue", "issue title", "finding",
        "finding name", "qid title", "alert", "weakness",
    ),
    "description": (
        "description", "descripcion", "descripción", "synopsis", "summary", "detalle", "details",
        "overview", "abstract", "diagnosis",
    ),
    "severity": (
        "severity", "severidad", "risk", "riesgo", "criticality", "priority", "priority level",
        "threat level", "danger", "rating", "risk factor",
    ),
    "component": (
        "component", "componente", "componentes afectados", "affected components",
        "url", "fqdn", "resource", "site", "endpoint", "affected asset",
    ),
    "hosts": (
        "host", "hosts", "hosts afectados", "affected hosts", "hostname", "ip", "ip address",
        "asset", "target", "dns name", "netbios",
    ),
    "asset_group": ("asset group", "grupo de activos", "grupo activos", "asset_group", "grupos de activos"),
    "asset_subgroup": (
        "asset subgroup", "subgrupo de activos", "sub grupo de activos", "subgrupo",
        "sub grupo", "subgrupos de activos", "sub grupos de activos",
    ),
    "asset_type": ("asset type", "tipo de activo", "tipo activo", "asset_type"),
    "cve": ("cve", "cves", "cve id", "cve ids", "cve number"),
    "cwe": ("cwe", "cwe id", "cwe ids", "weakness id"),
    "cvss": (
        "cvss", "cvss score", "cvss v3.1 base score", "cvss v3.0 base score", "cvss v3 base score",
        "cvss base score", "cvss2", "cvss3", "base score", "cvss temporal score",
    ),
    "impact": ("impact", "impacto", "threat", "amenaza", "danger", "consequence", "consequences"),
    "remediation": (
        "remediation", "remediacion", "remediación", "solution", "solucion", "solución", "fix",
        "see also", "corrective action",
    ),
    "recommendation": (
        "recommendation", "recomendacion", "recomendación", "recommendations", "recomendaciones",
    ),
    "remediation_time": (
        "remediation time", "tiempo de remediacion", "tiempo de remediación", "remediation sla",
        "tiempo remediacion", "plazo de remediacion", "plazo remediacion",
    ),
    "mitigation_type": (
        "mitigation type", "tipo de mitigacion", "tipo de mitigación", "tipo mitigacion",
        "mitigation", "mitigacion", "mitigación",
    ),
    "detected_date": (
        "detected date", "fecha de deteccion", "fecha de detección", "detection date", "found date",
    ),
    "registered_date": (
        "registered date", "fecha de registro", "registration date", "created date", "fecha registro",
    ),
    "status": ("status", "estatus", "estado", "state", "finding status"),
    "project": ("project", "proyecto", "engagement", "engagement name"),
    "comments": (
        "comments", "comentarios", "justification", "justificacion", "justificación",
        "comentarios justificacion", "comentarios/justificación", "comentarios justificación",
    ),
    "security_comments": (
        "security comments", "comentarios de seguridad", "comentarios seguridad", "security notes",
    ),
    "evidence": (
        "evidence", "evidencia", "plugin output", "output", "proof", "raw", "result", "scan output",
        "technical result", "request response",
    ),
    "method": (
        "method", "metodo", "método", "detection method", "metodo_deteccion", "herramienta de deteccion",
        "herramienta de detección", "detection tool", "source", "check type", "test type", "scanner",
    ),
    "epss": ("epss", "epss score", "epss_score", "exploit prediction", "exploit prediction score"),
    "kev": (
        "kev", "kev listed", "cisa kev", "known exploited", "exploited vulnerability",
        "known exploited vulnerabilities", "in kev catalog",
    ),
}

FIELD_LABELS_ES: dict[str, str] = {
    "title": "Título",
    "description": "Descripción",
    "severity": "Severidad",
    "component": "Componentes afectados",
    "hosts": "Hosts afectados",
    "asset_group": "Grupo de activos",
    "asset_subgroup": "Subgrupo de activos",
    "asset_type": "Tipo de activo",
    "cve": "CVE",
    "cwe": "CWE",
    "cvss": "CVSS",
    "impact": "Impacto",
    "remediation": "Remediación",
    "recommendation": "Recomendación",
    "remediation_time": "Tiempo de remediación",
    "mitigation_type": "Tipo de mitigación",
    "detected_date": "Fecha de detección",
    "registered_date": "Fecha de registro",
    "status": "Estatus",
    "project": "Proyecto",
    "comments": "Comentarios / justificación",
    "security_comments": "Comentarios de seguridad",
    "evidence": "Evidencia",
    "method": "Herramienta de detección",
    "epss": "EPSS",
    "kev": "KEV",
}
