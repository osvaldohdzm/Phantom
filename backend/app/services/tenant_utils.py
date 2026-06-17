from __future__ import annotations

import re


def normalize_tenant_slug(raw: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (raw or "").strip().lower()).strip("-")
    if not slug:
        raise ValueError("slug vacío")
    return slug[:64]
