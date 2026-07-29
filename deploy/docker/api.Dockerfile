FROM python:3.11-slim-bookworm

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends libpq5 gcc libpq-dev \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY scripts/docker-entrypoint-api.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PYTHONPATH=/app/backend
ENV PYTHONUNBUFFERED=1

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
