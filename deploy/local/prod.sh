#!/usr/bin/env bash
# Run Phantom in production mode locally on the host
set -euo pipefail
cd "$(dirname "$0")/../.."
exec ./phantom local prod "$@"
