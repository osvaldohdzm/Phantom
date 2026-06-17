"""Preprocesado de texto de hallazgos (equivalente CYB008/CYB009/CYB032 VBA)."""

from __future__ import annotations

import html
import re
from typing import Optional

# Viñetas que la plantilla Word ya aplica — no duplicar en el texto insertado
BULLET_CHARS = (
    "\u2022\u2023\u25aa\u25ab\u25cf\u25cb\u25e6\u2043\u2219\u00b7"
    "\uf0b7\uf0a7\uf076\uf0d8\u25c6\u25a0\u2013\u2014"
    "▪●•·◦‣⁃"
)
_HTML_TAG_RE = re.compile(r"<[^>]+>", re.IGNORECASE)
_BULLET_CLASS = re.escape(BULLET_CHARS)
# Al inicio de línea: viñetas Unicode o guion/asterisco seguidos de espacio
BULLET_PREFIX_RE = re.compile(
    rf"^(?:[\s{_BULLET_CLASS}\t]+|(?:[-*])\s+)+"
)
# Entre ítems en la misma línea (no divide CWE-200 ni guiones en palabras)
BULLET_SPLIT_RE = re.compile(rf"\s+(?:[{_BULLET_CLASS}])+\s+")
# Ítems de informe « - texto» (espacio, guion, espacio): se conservan tal cual en Word.
REPORT_HYPHEN_LIST_LINE_RE = re.compile(r"^\s*-\s+\S")

def strip_html_tags(text: str) -> str:
    """Quita etiquetas HTML; convierte <br> en saltos de línea (CYB009)."""
    t = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    return _HTML_TAG_RE.sub("", t)


def normalize_line_breaks(text: str) -> str:
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = t.replace("[[BR]]", "\n")
    while "\n\n\n" in t:
        t = t.replace("\n\n\n", "\n\n")
    return t.strip()


def decode_html_entities(text: str) -> str:
    t = text
    for entity, char in (
        ("&#x27;", "'"),
        ("&#34;", '"'),
        ("&#39;", "'"),
        ("&quot;", '"'),
        ("&apos;", "'"),
        ("&amp;", "&"),
        ("&lt;", "<"),
        ("&gt;", ">"),
        ("&#160;", " "),
    ):
        t = t.replace(entity, char)
    try:
        t = html.unescape(t)
    except Exception:
        pass
    return t


_PLUGIN_OUTPUT_RE = re.compile(r"plugin\s+output\s*:\s*", re.IGNORECASE)
_NESSUS_HEADER_LINE_RE = re.compile(
    r"^(?:\[Nessus CSV\]|Plugin ID:|Host:|Puerto:|Protocol:|CVE:|Synopsis:)",
    re.IGNORECASE,
)


def extract_plugin_output_text(text: Optional[str]) -> str:
    """Solo el bloque Plugin Output; ignora metadatos de auto-ingesta Nessus."""
    if not text:
        return ""
    t = str(text).strip()
    if not t:
        return ""
    match = _PLUGIN_OUTPUT_RE.search(t)
    if match:
        return t[match.end() :].strip()
    if "[nessus csv]" in t.lower():
        lines = t.split("\n")
        body: list[str] = []
        past_headers = False
        for line in lines:
            stripped = line.strip()
            if not stripped:
                if body:
                    past_headers = True
                continue
            if not past_headers and _NESSUS_HEADER_LINE_RE.match(stripped):
                continue
            past_headers = True
            body.append(line)
        return "\n".join(body).strip()
    return t


def clean_tool_output(text: str, *, for_markdown: bool = False) -> str:
    """CYB009_ProcesadoCompletoSalidaHerramientas — limpia salidas antes de Word."""
    if not text:
        return ""
    t = normalize_line_breaks(str(text))
    t = decode_html_entities(t)
    t = t.replace("\\t", "")
    while t.startswith("\n"):
        t = t[1:]
    while t.endswith("\n"):
        t = t[:-1]
    if not for_markdown:
        lines: list[str] = []
        for raw in t.split("\n"):
            line = raw.strip()
            if len(line) <= 3:
                continue
            lines.append(raw.lstrip("\t"))
        t = "\n".join(lines)
    t = t.replace("Nessus", "The scanner tool")
    t = t.replace("/http", "/\nhttp")
    return t.strip()


def cyb009_salidas_herramienta(text: Optional[str], *, for_markdown: bool = False) -> str:
    """Punto único CYB009 para «Salidas de herramienta» (Excel macro / Word)."""
    return clean_tool_output(
        extract_plugin_output_text(text or ""), for_markdown=for_markdown
    )


def salida_herramienta_for_report(text: Optional[str], *, for_markdown: bool = False) -> str:
    """Plugin output limpio listo para informe (una pasada CYB009)."""
    return cyb009_salidas_herramienta(text, for_markdown=for_markdown)


def normalize_severity_label(severity: str) -> str:
    """CYB032 / FormatearCeldaNivelRiesgo — etiquetas INAI en español."""
    s = (severity or "").strip().upper()
    mapping = {
        "0": "INFORMATIVA",
        "NONE": "INFORMATIVA",
        "INFO": "INFORMATIVA",
        "INFORMATIVA": "INFORMATIVA",
        "INFORMATIVO": "INFORMATIVA",
        "1": "BAJA",
        "2": "BAJA",
        "3": "BAJA",
        "4": "BAJA",
        "BAJO": "BAJA",
        "BAJA": "BAJA",
        "LOW": "BAJA",
        "5": "MEDIA",
        "6": "MEDIA",
        "MEDIO": "MEDIA",
        "MEDIA": "MEDIA",
        "MEDIUM": "MEDIA",
        "7": "ALTA",
        "8": "ALTA",
        "ALTO": "ALTA",
        "ALTA": "ALTA",
        "HIGH": "ALTA",
        "9": "CRÍTICA",
        "10": "CRÍTICA",
        "CRITICA": "CRÍTICA",
        "CRÍTICA": "CRÍTICA",
        "CRÍTICO": "CRÍTICA",
        "CRITICAL": "CRÍTICA",
    }
    if s in mapping:
        return mapping[s]
    # Severidad enum inglés
    en_map = {
        "CRITICAL": "CRÍTICA",
        "HIGH": "ALTA",
        "MEDIUM": "MEDIA",
        "LOW": "BAJA",
        "INFO": "INFORMATIVA",
    }
    return en_map.get(s, severity)


def is_report_hyphen_list_line(line: str) -> bool:
    """Línea con prefijo « - » de informe (remediación, amenaza, etc.)."""
    return bool(REPORT_HYPHEN_LIST_LINE_RE.match(line))


def strip_line_bullet_prefix(line: str) -> str:
    """Quita viñetas Unicode o «*»; conserva líneas « - ítem» para Word."""
    if is_report_hyphen_list_line(line):
        return line.rstrip()
    cur = line
    while True:
        nxt = BULLET_PREFIX_RE.sub("", cur, count=1)
        if nxt == cur:
            return nxt.strip()
        cur = nxt


def split_plain_lines(text: Optional[str], *, split_inline_bullets: bool = False) -> list[str]:
    """Un ítem por línea, sin viñetas ni marcadores."""
    if not text:
        return []
    lines: list[str] = []
    for raw in normalize_line_breaks(str(text)).split("\n"):
        chunks = BULLET_SPLIT_RE.split(raw) if split_inline_bullets else [raw]
        for chunk in chunks:
            cleaned = strip_line_bullet_prefix(chunk)
            if cleaned:
                lines.append(cleaned)
    return lines


def strip_bullet_markers(text: Optional[str], *, split_inline_bullets: bool = False) -> str:
    """Elimina viñetas de cada línea; solo saltos de línea entre ítems."""
    return "\n".join(split_plain_lines(text, split_inline_bullets=split_inline_bullets))


def _capitalize_first_alpha(segment: str) -> str:
    chars = list(segment)
    for i, ch in enumerate(chars):
        if ch.isalpha():
            chars[i] = ch.upper()
            break
    return "".join(chars)


def capitalize_line_starts(text: str) -> str:
    """Primera letra mayúscula al inicio de cada párrafo/línea (informe formal)."""
    if not text:
        return text
    lines: list[str] = []
    for line in text.split("\n"):
        stripped = line.lstrip()
        if not stripped:
            lines.append(line)
            continue
        if stripped.startswith(("#", "```", "![", "|")):
            lines.append(line)
            continue
        if is_report_hyphen_list_line(line):
            match = re.match(r"^(\s*-\s+)(.*)$", line)
            if match:
                prefix, body = match.group(1), match.group(2)
                lines.append(prefix + _capitalize_first_alpha(body).rstrip())
                continue
        leading = line[: len(line) - len(stripped)]
        lines.append(leading + _capitalize_first_alpha(stripped))
    return "\n".join(lines)


def preprocess_report_field(
    text: Optional[str],
    *,
    tool_output: bool = False,
    strip_bullets: bool = False,
    split_inline_bullets: bool = False,
    capitalize: bool = True,
) -> str:
    if not text:
        return ""
    t = strip_html_tags(str(text))
    t = normalize_line_breaks(t)
    t = decode_html_entities(t)
    if tool_output:
        t = clean_tool_output(t)
    if strip_bullets:
        t = strip_bullet_markers(t, split_inline_bullets=split_inline_bullets)
    if capitalize and not tool_output:
        t = capitalize_line_starts(t)
    return t
