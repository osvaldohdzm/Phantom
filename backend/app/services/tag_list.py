"""Listas de etiquetas (grupos, subgrupos) separadas por ; , | o salto de línea."""

from __future__ import annotations

import re

_TAG_SPLIT = re.compile(r"[;|,\n]+")


def parse_tag_list(value: str | None) -> list[str]:
    if not value or not str(value).strip():
        return []
    seen: set[str] = set()
    out: list[str] = []
    for part in _TAG_SPLIT.split(str(value).strip()):
        tag = part.strip()
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(tag)
    return out


def merge_tag_lists(*values: str | list[str] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in values:
        if raw is None:
            continue
        items = raw if isinstance(raw, list) else parse_tag_list(raw)
        for tag in items:
            key = tag.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(tag.strip())
    return out


def format_tag_list(tags: list[str], sep: str = " · ") -> str:
    return sep.join(tags)
