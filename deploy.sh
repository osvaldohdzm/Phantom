#!/usr/bin/env bash
# Delega en ops/update.sh — usa ./phantom help para ver todos los comandos.
exec "$(cd "$(dirname "$0")" && pwd)/ops/update.sh" "$@"
