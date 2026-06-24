#!/bin/sh
set -eu

echo "[api] Waiting for PostgreSQL…"
python - <<'PY'
import os, sys, time
from urllib.parse import urlparse

url = os.environ.get("DATABASE_URL", "")
if not url:
    sys.exit("DATABASE_URL is required")

parsed = urlparse(url.replace("postgresql+psycopg2://", "postgresql://", 1))
import psycopg2

for attempt in range(90):
    try:
        psycopg2.connect(
            host=parsed.hostname or "postgres",
            port=parsed.port or 5432,
            user=parsed.username,
            password=parsed.password,
            dbname=(parsed.path or "/katana_security_db").lstrip("/"),
        ).close()
        break
    except Exception as exc:
        if attempt == 89:
            raise SystemExit(f"PostgreSQL not ready: {exc}") from exc
        time.sleep(1)
PY

echo "[api] Bootstrapping schema and seed data…"
python -m app.bootstrap_db
export PHANTOM_DB_BOOTSTRAPPED=1

WORKERS="${UVICORN_WORKERS:-2}"
echo "[api] Starting Uvicorn (${WORKERS} workers) on :8000"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "$WORKERS" \
  --proxy-headers \
  --forwarded-allow-ips='*'
