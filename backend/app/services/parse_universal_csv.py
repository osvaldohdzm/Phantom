"""Parse arbitrary CSV exports into normalized finding drafts with column mapping."""

from __future__ import annotations

import csv
import io
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from app.models.core import FindingStatus
from app.services.ingest_common import clamp_title, map_scanner_severity, parse_datetime_maybe, parse_float_maybe
from app.services.report_text_preprocess import preprocess_report_field
from app.services.tag_list import merge_tag_lists, parse_tag_list
from app.services.text_encoding import decode_bytes_smart, fix_text_encoding
from app.services.universal_csv_fields import (
    FIELD_ALIASES,
    FIELD_LABELS_ES,
    NEGATIVE_HEADER_TOKENS,
    STANDARD_FIELDS,
)

DEFAULT_UNIVERSAL_METODO = "Importación CSV universal"

_MIN_AUTO_SCORE = 52
_CSV_DELIMITERS = (",", ";", "\t")
_SHARED_HEADER_PAIRS = (("recommendation", "remediation"),)
_CVE_RE = re.compile(r"CVE-\d{4}-\d{4,}", re.IGNORECASE)
_CWE_RE = re.compile(r"CWE-\d+", re.IGNORECASE)
_CVSS_RE = re.compile(r"cvss[\s:v]*(\d+(?:\.\d+)?)", re.IGNORECASE)


def _norm_header(h: str) -> str:
    import unicodedata

    s = (h or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    for ch in "_-./:":
        s = s.replace(ch, " ")
    return " ".join(s.split())


def _compact_alnum(h: str) -> str:
    return "".join(c for c in _norm_header(h) if c.isalnum())


def _header_has_negative_token(header: str, field: str) -> bool:
    tokens = NEGATIVE_HEADER_TOKENS.get(field, ())
    if not tokens:
        return False
    h = _norm_header(header)
    return any(t in h for t in tokens)


def _score_header_match(header: str, alias: str, field: str) -> int:
    h = _norm_header(header)
    a = _norm_header(alias)
    if not h or not a:
        return 0
    score = 0
    if h == a:
        score = 100
    else:
        hc, ac = _compact_alnum(header), _compact_alnum(alias)
        if hc and ac and hc == ac:
            score = 95
        elif len(a) >= 4 and a in h:
            score = 78
        elif len(h) >= 4 and h in a:
            score = 68
        else:
            h_tokens = {t for t in h.split() if len(t) > 1}
            a_tokens = [t for t in a.split() if len(t) > 1]
            if a_tokens:
                overlap = sum(1 for t in a_tokens if t in h_tokens)
                if overlap:
                    ratio = overlap / max(len(h_tokens), len(a_tokens))
                    score = int(45 + ratio * 40)
    if score > 0 and _header_has_negative_token(header, field):
        score = max(0, score - 45)
    return score


def _count_fields_quote_aware(line: str, delimiter: str) -> int:
    count = 1
    in_quotes = False
    i = 0
    while i < len(line):
        ch = line[i]
        if in_quotes:
            if ch == '"':
                if i + 1 < len(line) and line[i + 1] == '"':
                    i += 2
                    continue
                in_quotes = False
            i += 1
            continue
        if ch == '"':
            in_quotes = True
        elif ch == delimiter:
            count += 1
        i += 1
    return count


def _detect_csv_delimiter(text: str) -> str:
    if not text.strip():
        return ","
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln for ln in normalized.split("\n") if ln.strip()][:20]
    if not lines:
        return ","

    best = ","
    best_score = -1
    for delim in _CSV_DELIMITERS:
        counts = [_count_fields_quote_aware(ln, delim) for ln in lines]
        freq = Counter(counts)
        mode, matches = freq.most_common(1)[0]
        if mode <= 1:
            continue
        score = matches * 1000 + mode
        if score > best_score:
            best_score = score
            best = delim
        elif score == best_score and delim == ";":
            best = ";"

    if best_score < 0:
        sample = normalized[:8000]
        tab_count = sample.count("\t")
        semi_count = sample.count(";")
        comma_count = sample.count(",")
        if tab_count and tab_count >= semi_count and tab_count >= comma_count:
            return "\t"
        if semi_count > comma_count:
            return ";"
        return ","
    return best


def _parse_csv_rows(text: str) -> tuple[list[str], list[dict[str, str]]]:
    delimiter = _detect_csv_delimiter(text)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        return [], []
    headers = [h or "" for h in reader.fieldnames]
    rows = [{k or "": (v or "") for k, v in raw.items()} for raw in reader]
    return headers, rows


def _can_share_csv_header(field: str, header: str, resolved: dict[str, str]) -> bool:
    for a, b in _SHARED_HEADER_PAIRS:
        if field not in (a, b):
            continue
        partner = b if field == a else a
        if resolved.get(partner) == header:
            return True
    return False


def _extract_cve(text: str) -> str:
    if not text:
        return ""
    m = _CVE_RE.search(text)
    return m.group(0).upper() if m else ""


def _extract_cwe(text: str) -> str:
    if not text:
        return ""
    m = _CWE_RE.search(text)
    return m.group(0).upper() if m else ""


def _extract_cvss(text: str) -> str:
    if not text:
        return ""
    m = _CVSS_RE.search(text)
    return m.group(1) if m else ""


def _t(value: str) -> str:
    return fix_text_encoding(value) or value


def _build_header_index(headers: list[str]) -> dict[str, str]:
    return {_norm_header(h): h for h in headers if h}


def _resolve_column_map(
    headers: list[str],
    column_map: dict[str, str] | None,
) -> dict[str, str]:
    index = _build_header_index(headers)
    resolved: dict[str, str] = {}

    if column_map:
        for field, header in column_map.items():
            if field not in STANDARD_FIELDS:
                continue
            key = _norm_header(header)
            if key in index:
                resolved[field] = index[key]
        auto = _auto_resolve_column_map(
            headers,
            exclude_fields=set(resolved.keys()),
            exclude_headers=set(resolved.values()),
        )
        resolved.update(auto)
        return resolved

    return _auto_resolve_column_map(headers)


def _auto_resolve_column_map(
    headers: list[str],
    exclude_fields: set[str] | None = None,
    exclude_headers: set[str] | None = None,
) -> dict[str, str]:
    skip = exclude_fields or set()
    reserved_headers = exclude_headers or set()
    resolved: dict[str, str] = {}
    candidates: list[tuple[int, str, str]] = []
    for field in STANDARD_FIELDS:
        if field in skip:
            continue
        aliases = (*FIELD_ALIASES.get(field, ()), field)
        for header in headers:
            if not header.strip() or header in reserved_headers:
                continue
            best = max(_score_header_match(header, alias, field) for alias in aliases)
            if best >= _MIN_AUTO_SCORE:
                candidates.append((best, field, header))

    candidates.sort(key=lambda x: (-x[0], x[1]))
    used_headers: set[str] = set()
    for _score, field, header in candidates:
        if field in resolved:
            continue
        if header in used_headers and not _can_share_csv_header(field, header, resolved):
            continue
        resolved[field] = header
        if not _can_share_csv_header(field, header, resolved):
            used_headers.add(header)
    if resolved.get("recommendation") and "remediation" not in resolved:
        resolved["remediation"] = resolved["recommendation"]
    return resolved


def _get_mapped(row: dict[str, str], column_map: dict[str, str], field: str) -> str:
    header = column_map.get(field)
    if not header:
        return ""
    raw = (row.get(header) or "").strip()
    if not raw:
        return ""
    return _t(raw)


def _parse_kev(value: str) -> bool:
    if not value:
        return False
    t = value.strip().lower()
    if t in ("1", "true", "yes", "y", "si", "sí", "listed", "kev", "exploited", "x"):
        return True
    if t in ("0", "false", "no", "n", "not listed", "-", "none", "n/a", "na"):
        return False
    return "kev" in t or "exploited" in t or "catalog" in t


def _append_note(parts: list[str], label: str, value: str) -> None:
    if value:
        parts.append(f"{label}: {value}")


def _parse_date_maybe(value: str) -> datetime | None:
    return parse_datetime_maybe(value)


def _map_seguimiento_status(raw: str) -> FindingStatus | None:
    t = (raw or "").strip().lower()
    if not t:
        return None
    mapping = {
        "nueva": FindingStatus.abierta,
        "abierta": FindingStatus.abierta,
        "identificado": FindingStatus.abierta,
        "mitigada": FindingStatus.remediado,
        "remediada": FindingStatus.remediado,
        "cerrada": FindingStatus.cerrado,
        "cerrado": FindingStatus.cerrado,
        "en proceso": FindingStatus.en_proceso,
        "en proceso de remediacion": FindingStatus.en_proceso,
        "en proceso de remediación": FindingStatus.en_proceso,
        "riesgo aceptado": FindingStatus.riesgo_aceptado,
        "falso positivo": FindingStatus.falso_positivo,
    }
    return mapping.get(t)


def _build_import_context(row: dict[str, str], column_map: dict[str, str]) -> dict[str, Any]:
    """Metadatos Seguimiento: host, grupos/subgrupos (tags), proyecto, estatus."""
    ctx: dict[str, Any] = {}
    host = _get_mapped(row, column_map, "hosts")
    if host:
        ctx["host"] = host[:512]
    groups = merge_tag_lists(_get_mapped(row, column_map, "asset_group"))
    subgroups = merge_tag_lists(_get_mapped(row, column_map, "asset_subgroup"))
    if groups:
        ctx["asset_groups"] = groups
        ctx["asset_group"] = groups[0]
    if subgroups:
        ctx["asset_subgroups"] = subgroups
        ctx["asset_subgroup"] = subgroups[0]
    asset_type = _get_mapped(row, column_map, "asset_type")
    if asset_type:
        ctx["asset_type"] = asset_type[:128]
    seg_status = _get_mapped(row, column_map, "status")
    if seg_status:
        ctx["seguimiento_estatus"] = seg_status[:128]
    project = _get_mapped(row, column_map, "project")
    if project:
        ctx["project"] = project[:255]
    return ctx


def _build_component(row: dict[str, str], column_map: dict[str, str]) -> str | None:
    """Solo «Componentes afectados» (p. ej. IP:puerto o CPE); el host va aparte."""
    val = _get_mapped(row, column_map, "component")
    if val:
        return val[:4096]
    if "component" not in column_map:
        hosts = _get_mapped(row, column_map, "hosts")
        if hosts:
            return hosts[:4096]
    return None


def _build_referencias(row: dict[str, str], column_map: dict[str, str]) -> str | None:
    parts: list[str] = []
    for field in ("remediation_time", "registered_date", "comments"):
        val = _get_mapped(row, column_map, field)
        if val:
            _append_note(parts, FIELD_LABELS_ES.get(field, field), val)
    if not parts:
        return None
    return "\n".join(parts)[:32000]


def parse_universal_csv_bytes(
    data: bytes,
    column_map: dict[str, str] | None = None,
    encoding: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    text = data.decode(encoding, errors="replace") if encoding else decode_bytes_smart(data)
    headers, raw_rows = _parse_csv_rows(text)
    if not headers:
        return [], {}

    resolved_map = _resolve_column_map(headers, column_map)
    if "title" not in resolved_map:
        return [], resolved_map

    out: list[dict[str, Any]] = []
    for raw in raw_rows:
        row = {k or "": v or "" for k, v in raw.items()}
        title = _get_mapped(row, resolved_map, "title")
        if not title:
            continue

        desc = _get_mapped(row, resolved_map, "description")
        impact = _get_mapped(row, resolved_map, "impact")
        body = "\n\n".join(p for p in (desc, impact) if p)
        if not body:
            body = desc or impact or "(Sin descripción en export)"

        evidence = _get_mapped(row, resolved_map, "evidence")
        salidas = ""
        if evidence:
            salidas = preprocess_report_field(evidence, tool_output=True, capitalize=False)[:32000]

        severity_raw = _get_mapped(row, resolved_map, "severity")
        cvss_raw = _get_mapped(row, resolved_map, "cvss")
        if not cvss_raw:
            cvss_raw = _extract_cvss(desc) or _extract_cvss(title)
        epss_raw = _get_mapped(row, resolved_map, "epss")
        kev_raw = _get_mapped(row, resolved_map, "kev")
        method = _get_mapped(row, resolved_map, "method") or DEFAULT_UNIVERSAL_METODO
        remediation = _get_mapped(row, resolved_map, "recommendation") or _get_mapped(
            row, resolved_map, "remediation"
        )
        component = _build_component(row, resolved_map)
        cve = _get_mapped(row, resolved_map, "cve")
        if not cve:
            cve = _extract_cve(desc) or _extract_cve(title)
        cwe = _get_mapped(row, resolved_map, "cwe")
        if not cwe:
            cwe = _extract_cwe(desc) or _extract_cwe(title)
        referencias = _build_referencias(row, resolved_map)
        security = _get_mapped(row, resolved_map, "security_comments")
        import_context = _build_import_context(row, resolved_map)
        seg_status_raw = _get_mapped(row, resolved_map, "status")
        finding_status = _map_seguimiento_status(seg_status_raw)
        first_seen = _parse_date_maybe(_get_mapped(row, resolved_map, "detected_date"))
        last_seen = _parse_date_maybe(_get_mapped(row, resolved_map, "registered_date"))
        mitigation = _get_mapped(row, resolved_map, "mitigation_type")
        csv_project = _get_mapped(row, resolved_map, "project")

        out.append(
            {
                "titulo": clamp_title(title),
                "descripcion": body[:32000],
                "severidad": map_scanner_severity(severity_raw or None),
                "cvss_score": parse_float_maybe(cvss_raw) if cvss_raw else None,
                "cve": cve[:32] if cve else None,
                "cwe": cwe[:32] if cwe else None,
                "componente_afectado": component,
                "metodo_deteccion": method[:4096],
                "tool_source": "universal-csv",
                "propuesta_remediacion": remediation[:32000] if remediation else None,
                "amenaza_ampliada": impact[:32000] if impact else None,
                "raw_tool_output": salidas if salidas else None,
                "epss_score": parse_float_maybe(epss_raw) if epss_raw else None,
                "kev_listed": _parse_kev(kev_raw),
                "referencias": referencias,
                "explicacion_tecnica": security[:32000] if security else None,
                "finding_status": finding_status,
                "first_seen": first_seen,
                "last_seen": last_seen,
                "remediation_context": mitigation[:32000] if mitigation else None,
                "csv_project": csv_project[:255] if csv_project else None,
                "import_context": import_context or None,
            }
        )
    return out, resolved_map
