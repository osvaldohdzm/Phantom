# Phantom hybrid parser services

| Service | Path | Runtime | Role |
|---------|------|---------|------|
| `phantom-ingest` | `services/phantom-ingest` | Go | Nessus CSV + Nmap parse API |
| `phantom-parse` | `services/phantom-parse` | Rust | Fast Nessus targets + dedup |

## Build locally

```bash
cd services/phantom-ingest && go build -o phantom-ingest .
cd services/phantom-parse && cargo build --release
```

## Docker (via compose)

```bash
./phantom start   # builds ingest-go + parse-rust + api
```

See [docs/architecture/hybrid-stack.md](../docs/architecture/hybrid-stack.md).
