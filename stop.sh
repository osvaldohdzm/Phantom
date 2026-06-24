#!/usr/bin/env bash
# Delega en ops/stop.sh — usa ./phantom help para ver todos los comandos.
exec "$(cd "$(dirname "$0")" && pwd)/ops/stop.sh" "$@"
