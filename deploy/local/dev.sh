#!/usr/bin/env bash
# Start Phantom in development mode locally on the host
set -euo pipefail
cd "$(dirname "$0")/../.."
exec ./phantom local dev "$@"
