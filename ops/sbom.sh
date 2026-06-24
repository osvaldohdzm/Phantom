#!/usr/bin/env bash
# Phantom — generar SBOM (SPDX + CycloneDX) y escaneo de vulnerabilidades (Grype).
# Uso: ./phantom sbom [--images] [--ci]
set -euo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
PHANTOM_ROOT="$(cd "$OPS_DIR/.." && pwd)"
export PHANTOM_ROOT
# shellcheck source=lib.sh
source "$OPS_DIR/lib.sh"

SCAN_IMAGES=0
CI_MODE=0
for arg in "$@"; do
  case "$arg" in
    --images) SCAN_IMAGES=1 ;;
    --ci) CI_MODE=1 ;;
    -h|--help)
      cat <<EOF
Uso: ./phantom sbom [--images] [--ci]

Genera SBOM en storage/sbom/ (SPDX JSON + CycloneDX JSON por componente).
Con Grype disponible, añade reportes de vulnerabilidades (.grype.txt).

  --images   Tras build, escanear imágenes Docker (api, web, ingest-go, parse-rust)
  --ci       Modo CI: falla si Grype encuentra Critical/High

Requisitos: syft (https://github.com/anchore/syft) o Docker.
EOF
      exit 0
      ;;
  esac
done

OUT_DIR="${PHANTOM_ROOT}/storage/sbom"
mkdir -p "$OUT_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
MANIFEST="${OUT_DIR}/manifest-${TS}.json"
GRYPE_FAIL=0

run_syft() {
  if command -v syft >/dev/null 2>&1; then
    syft "$@"
  else
    docker run --rm \
      -v "${PHANTOM_ROOT}:/src:ro" \
      -v "${OUT_DIR}:/out" \
      anchore/syft:latest "$@"
  fi
}

run_grype() {
  if command -v grype >/dev/null 2>&1; then
    grype "$@"
  else
    docker run --rm \
      -v "${OUT_DIR}:/out:ro" \
      anchore/grype:latest "$@"
  fi
}

scan_dir() {
  local name="$1"
  local rel_dir="$2"
  shift 2
  local spdx="${OUT_DIR}/${name}-${TS}.spdx.json"
  local cdx="${OUT_DIR}/${name}-${TS}.cdx.json"
  local grype_out="${OUT_DIR}/${name}-${TS}.grype.txt"
  local target="dir:${PHANTOM_ROOT}/${rel_dir}"
  local docker_target="dir:/src/${rel_dir}"

  echo "[*] SBOM ${name} ← ${rel_dir}"
  if command -v syft >/dev/null 2>&1; then
    syft "$target" -o "spdx-json=${spdx}" "$@"
    syft "$target" -o "cyclonedx-json=${cdx}" "$@" 2>/dev/null || true
  else
    run_syft "$docker_target" -o "spdx-json=/out/${name}-${TS}.spdx.json" "$@"
    run_syft "$docker_target" -o "cyclonedx-json=/out/${name}-${TS}.cdx.json" "$@" 2>/dev/null || true
  fi

  if run_grype "sbom:${spdx}" -o table > "$grype_out" 2>/dev/null; then
    echo "    Grype → $(basename "$grype_out")"
    if [[ "$CI_MODE" -eq 1 ]] && grep -qE 'Critical|High' "$grype_out"; then
      echo "[!] Grype: vulnerabilidades Critical/High en ${name}" >&2
      GRYPE_FAIL=1
    fi
  fi
}

echo "============================================================"
echo " Phantom — SBOM / supply chain"
echo " Salida: ${OUT_DIR}"
echo "============================================================"

scan_dir api-backend backend
scan_dir ingest-go services/phantom-ingest
scan_dir parse-rust services/phantom-parse
scan_dir web-frontend . \
  --exclude "./backend" \
  --exclude "./services" \
  --exclude "./.next" \
  --exclude "./node_modules" \
  --exclude "./storage" \
  --exclude "./.git"

if [[ "$SCAN_IMAGES" -eq 1 ]]; then
  if phantom_require_compose 2>/dev/null; then
    echo "[*] Build imágenes para SBOM Docker…"
    phantom_compose build api web ingest-go parse-rust
    for svc in api web ingest-go parse-rust; do
      img="$(phantom_compose images -q "$svc" 2>/dev/null | head -1)"
      [[ -z "$img" ]] && continue
      echo "[*] SBOM imagen ${svc}"
      local_name="image-${svc}"
      if command -v syft >/dev/null 2>&1; then
        syft "docker:${img}" -o "spdx-json=${OUT_DIR}/${local_name}-${TS}.spdx.json"
      else
        docker run --rm \
          -v /var/run/docker.sock:/var/run/docker.sock \
          -v "${OUT_DIR}:/out" \
          anchore/syft:latest \
          "docker:${img}" -o "spdx-json=/out/${local_name}-${TS}.spdx.json"
      fi
    done
  else
    echo "[!] --images requiere Docker Compose" >&2
  fi
fi

cat > "$MANIFEST" <<EOF
{
  "generated_at": "${TS}",
  "components": ["api-backend", "ingest-go", "parse-rust", "web-frontend"],
  "formats": ["spdx-json", "cyclonedx-json"],
  "directory": "storage/sbom"
}
EOF

echo ""
echo "[+] SBOM generado en ${OUT_DIR}"
echo "    Manifiesto: $(basename "$MANIFEST")"

if [[ "$GRYPE_FAIL" -eq 1 ]]; then
  exit 2
fi
