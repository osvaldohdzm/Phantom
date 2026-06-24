FROM docker.io/library/rust:1.82-bookworm AS build
WORKDIR /src
COPY services/phantom-parse/ ./
RUN cargo build --release

FROM docker.io/library/debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/phantom-parse /usr/local/bin/phantom-parse
ENV PARSE_RUST_ADDR=0.0.0.0:8081
EXPOSE 8081
HEALTHCHECK --interval=10s --timeout=3s --retries=6 \
  CMD wget -qO- http://127.0.0.1:8081/health || exit 1
ENTRYPOINT ["/usr/local/bin/phantom-parse"]
