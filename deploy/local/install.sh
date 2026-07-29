#!/usr/bin/env bash
# Install Phantom locally on the host
set -euo pipefail
cd "$(dirname "$0")/../.."
exec ./phantom local install "$@"
