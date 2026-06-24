"""Parse Nessus / Tenable export CSV into normalized finding drafts."""

from __future__ import annotations

import csv
import io
from typing import Any, Optional

from app.services.ingest_common import clamp_title, map_scanner_severity, parse_datetime_maybe, parse_float_maybe
from app.services.report_text_preprocess import preprocess_report_field
from app.services.text_encoding import decode_bytes_smart, fix_text_encoding
from app.services.vulns_catalog_lookup import build_componente_afectado

DEFAULT_NESSUS_METODO = "Escaneo automatizado con Nessus"


def _norm_header(h: str) -> str:
    return " ".join((h or "").strip().lower().split())


def _build_header_index(fieldnames: list[str] | None) -> dict[str, str]:
    """Mapa header normalizado → clave original del CSV."""
    out: dict[str, str] = {}
    for name in fieldnames or []:
        norm = _norm_header(name)
        if norm and norm not in out:
            out[norm] = name
    return out


def _get_indexed(row: dict[str, str], index: dict[str, str], *candidates: str) -> str:
    for c in candidates:
        key = _norm_header(c)
        orig = index.get(key)
        if not orig:
            continue
        raw = (row.get(orig) or "").strip()
        if raw:
            return fix_text_encoding(raw) or raw
    return ""


def _t(value: str) -> str:
    return fix_text_encoding(value) or value


def parse_nessus_csv_bytes(data: bytes, encoding: str | None = None) -> list[dict[str, Any]]:
    text = data.decode(encoding, errors="replace") if encoding else decode_bytes_smart(data)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []

    header_index = _build_header_index(list(reader.fieldnames))
    out: list[dict[str, Any]] = []
    for raw in reader:
        row = {k or "": v or "" for k, v in raw.items()}
        name = _get_indexed(
            row,
            header_index,
            "name",
            "plugin name",
            "nombre",
            "vulnerability",
            "plugin_name",
        )
        if not name:
            continue

        risk = _get_indexed(row, header_index, "risk", "severity", "riesgo", "criticality", "stig severity")
        synopsis = _get_indexed(row, header_index, "synopsis", "sinopsis", "summary")
        desc = _get_indexed(row, header_index, "description", "descripcion", "detalle")
        solution = _get_indexed(row, header_index, "solution", "solucion", "remediation")
        host = _get_indexed(row, header_index, "host", "dns name", "fqdn", "ip")
        port = _get_indexed(row, header_index, "port", "puerto")
        proto = _get_indexed(row, header_index, "protocol", "protocolo")
        cve = _get_indexed(row, header_index, "cve", "cves")
        cwe = _get_indexed(row, header_index, "cwe", "cwe id")
        cvss_v3 = _get_indexed(
            row,
            header_index,
            "cvss v3.0 base score",
            "cvss v3.1 base score",
            "cvss v3 base score",
            "cvss base score",
            "cvss",
        )
        cvss_v2 = _get_indexed(row, header_index, "cvss v2.0 base score", "cvss v2 base score")
        vector = _get_indexed(
            row, header_index, "cvss v3.0 vector", "cvss v3.1 vector", "cvss v3 vector", "cvss vector"
        )
        plugin_out = _get_indexed(row, header_index, "plugin output", "evidence", "output", "datos del plugin")
        plugin_id = _get_indexed(row, header_index, "plugin id", "plugin_id")
        first_found = _get_indexed(row, header_index, "first found", "first seen", "first_found", "first_seen")
        last_found = _get_indexed(row, header_index, "last found", "last seen", "last_found", "last_seen")

        cvss = parse_float_maybe(cvss_v3) or parse_float_maybe(cvss_v2)

        salidas = ""
        if plugin_out:
            if len(plugin_out) > 4000:
                salidas = (_t(plugin_out))[:32000]
            else:
                salidas = preprocess_report_field(
                    plugin_out, tool_output=True, capitalize=False
                )[:32000]

        synopsis_t = _t(synopsis) if synopsis else ""
        desc_t = _t(desc) if desc else ""
        solution_t = _t(solution) if solution else ""

        desc_body = "\n\n".join(p for p in (synopsis_t, desc_t) if p)
        if not desc_body:
            desc_body = synopsis_t or desc_t or "(Sin descripción en export)"

        explicacion = salidas or desc_t or None

        out.append(
            {
                "titulo": clamp_title(_t(name)),
                "descripcion": desc_body[:32000],
                "severidad": map_scanner_severity(risk or None),
                "cvss_score": cvss,
                "cvss_vector": vector[:128] if vector else None,
                "cve": cve[:32] if cve else None,
                "cwe": (cwe[:32] if cwe else None),
                "raw_tool_output": _t(salidas) if salidas else None,
                "metodo_deteccion": DEFAULT_NESSUS_METODO,
                "propuesta_remediacion": solution_t[:32000] if solution_t else None,
                "explicacion_tecnica": explicacion[:32000] if explicacion else None,
                "tool_source": "Nessus",
                "tool_vuln_id": plugin_id.strip() if plugin_id else None,
                "nessus_plugin_id": plugin_id,
                "host": host,
                "port": port,
                "proto": proto,
                "componente_afectado": build_componente_afectado(host, port, proto) or None,
                "first_seen": parse_datetime_maybe(first_found),
                "last_seen": parse_datetime_maybe(last_found),
                "import_context": {
                    "nessus_plugin_id": plugin_id.strip() if plugin_id else None,
                    "synopsis": synopsis_t[:4000] if synopsis_t else None,
                    "description_en": desc_t[:8000] if desc_t else None,
                    "solution_en": solution_t[:8000] if solution_t else None,
                },
            }
        )
    return out
