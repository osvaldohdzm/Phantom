"""Detección UTF-8 / Windows-1252 y reparación de mojibake en textos de importación."""

from __future__ import annotations

import re
from typing import Optional

_SPANISH = re.compile(r"[áéíóúñÁÉÍÓÚÑüÜ]")
_MOJIBAKE = re.compile(r"[\ufffd]|Ã[\x80-\xbf]|Ã.")
_CTRL = re.compile(r"[\u0080-\u009f]")
_PLUGIN_ID_RE = re.compile(r"Plugin ID:\s*(\d+)", re.IGNORECASE)


def spanish_char_count(text: str) -> int:
    return len(_SPANISH.findall(text or ""))


def extract_nessus_plugin_id(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    match = _PLUGIN_ID_RE.search(raw)
    return match.group(1) if match else None


def _score_text(text: str) -> int:
    score = text.count("\ufffd") * 80
    score += len(_MOJIBAKE.findall(text)) * 4
    score += len(_CTRL.findall(text)) * 2
    score -= spanish_char_count(text) * 2
    return score


def decode_bytes_smart(data: bytes) -> str:
    """Elige la mejor codificación entre UTF-8 y Windows-1252 / Latin-1 (sin decodificar UTF-8 permisivo)."""
    if not data:
        return ""
    best: tuple[int, str] | None = None
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = data.decode(enc)
        except UnicodeDecodeError:
            continue
        score = _score_text(text)
        if best is None or score < best[0]:
            best = (score, text)
    if best is not None:
        return best[1]
    return data.decode("cp1252", errors="replace")


def fix_text_encoding(text: Optional[str]) -> Optional[str]:
    """Repara mojibake (UTF-8 leído como Latin-1/CP1252) y caracteres de reemplazo."""
    if text is None:
        return None
    if not text.strip():
        return text

    candidates = [text]

    if "\ufffd" in text or "Ã" in text or _CTRL.search(text):
        for enc in ("latin-1", "cp1252"):
            try:
                fixed = text.encode(enc, errors="ignore").decode("utf-8")
                if fixed and fixed != text:
                    candidates.append(fixed)
            except (UnicodeDecodeError, UnicodeEncodeError):
                pass
        try:
            fixed2 = text.encode("utf-8", errors="ignore").decode("cp1252")
            if fixed2 and fixed2 != text:
                candidates.append(fixed2)
        except (UnicodeDecodeError, UnicodeEncodeError):
            pass

    for enc in ("latin-1", "cp1252"):
        try:
            mojibake_fix = text.encode(enc).decode("utf-8")
            if mojibake_fix != text:
                candidates.append(mojibake_fix)
        except (UnicodeDecodeError, UnicodeEncodeError):
            pass

    return min(candidates, key=_score_text)


def fix_optional_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return fix_text_encoding(value) or value
