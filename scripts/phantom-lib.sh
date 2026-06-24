#!/usr/bin/env bash
# Compatibilidad — delega en ops/lib.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../ops/lib.sh
source "$SCRIPT_DIR/../ops/lib.sh"
