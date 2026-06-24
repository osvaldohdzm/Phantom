FROM docker.io/library/golang:1.22-bookworm AS build
WORKDIR /src
COPY services/phantom-ingest/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /phantom-ingest .

FROM docker.io/library/debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /phantom-ingest /usr/local/bin/phantom-ingest
ENV INGEST_GO_ADDR=:8080
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=6 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["/usr/local/bin/phantom-ingest"]
