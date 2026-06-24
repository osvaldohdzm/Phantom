#!/usr/bin/env bash
# Delega en ops/verify-env.sh — usa ./phantom help para ver todos los comandos.
exec "$(cd "$(dirname "$0")" && pwd)/ops/verify-env.sh" "$@"
