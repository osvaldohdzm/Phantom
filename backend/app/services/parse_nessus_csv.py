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


def _get(row: dict[str, str], *candidates: str) -> str:
    """Lookup value using normalized header keys."""
    index: dict[str, str] = {_norm_header(k): v for k, v in row.items()}
    for c in candidates:
        key = _norm_header(c)
        if key in index and (index[key] or "").strip():
            return fix_text_encoding(index[key].strip()) or index[key].strip()
    return ""


def _t(value: str) -> str:
    return fix_text_encoding(value) or value


def parse_nessus_csv_bytes(data: bytes, encoding: str | None = None) -> list[dict[str, Any]]:
    text = data.decode(encoding, errors="replace") if encoding else decode_bytes_smart(data)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []

    out: list[dict[str, Any]] = []
    for raw in reader:
        row = {k or "": v or "" for k, v in raw.items()}
        name = _get(
            row,
            "name",
            "plugin name",
            "nombre",
            "vulnerability",
            "plugin_name",
        )
        if not name:
            continue

        risk = _get(row, "risk", "severity", "riesgo", "criticality", "stig severity")
        synopsis = _get(row, "synopsis", "sinopsis", "summary")
        desc = _get(row, "description", "descripcion", "detalle")
        solution = _get(row, "solution", "solucion", "remediation")
        host = _get(row, "host", "dns name", "fqdn", "ip")
        port = _get(row, "port", "puerto")
        proto = _get(row, "protocol", "protocolo")
        cve = _get(row, "cve", "cves")
        cwe = _get(row, "cwe", "cwe id")
        cvss_v3 = _get(
            row,
            "cvss v3.0 base score",
            "cvss v3.1 base score",
            "cvss v3 base score",
            "cvss base score",
            "cvss",
        )
        cvss_v2 = _get(row, "cvss v2.0 base score", "cvss v2 base score")
        vector = _get(row, "cvss v3.0 vector", "cvss v3.1 vector", "cvss v3 vector", "cvss vector")
        plugin_out = _get(row, "plugin output", "evidence", "output", "datos del plugin")
        plugin_id = _get(row, "plugin id", "plugin_id")
        first_found = _get(row, "first found", "first seen", "first_found", "first_seen")
        last_found = _get(row, "last found", "last seen", "last_found", "last_seen")

        cvss = parse_float_maybe(cvss_v3) or parse_float_maybe(cvss_v2)

        salidas = ""
        if plugin_out:
            salidas = preprocess_report_field(
                plugin_out, tool_output=True, capitalize=False
            )[:32000]

        body = "\n\n".join(p for p in (synopsis, desc, solution) if p)
        if not body:
            body = synopsis or desc or "(Sin descripción en export)"

        out.append(
            {
                "titulo": clamp_title(_t(name)),
                "descripcion": _t(body[:32000]),
                "severidad": map_scanner_severity(risk or None),
                "cvss_score": cvss,
                "cvss_vector": vector[:128] if vector else None,
                "cve": cve[:32] if cve else None,
                "cwe": (cwe[:32] if cwe else None),
                "raw_tool_output": _t(salidas) if salidas else None,
                "metodo_deteccion": DEFAULT_NESSUS_METODO,
                "tool_source": "Nessus",
                "tool_vuln_id": plugin_id.strip() if plugin_id else None,
                "nessus_plugin_id": plugin_id,
                "host": host,
                "port": port,
                "proto": proto,
                "componente_afectado": build_componente_afectado(host, port, proto) or None,
                "first_seen": parse_datetime_maybe(first_found),
                "last_seen": parse_datetime_maybe(last_found),
            }
        )
    return out
