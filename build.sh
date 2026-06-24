#!/usr/bin/env bash
# Delega en ops/build.sh — usa ./phantom help para ver todos los comandos.
exec "$(cd "$(dirname "$0")" && pwd)/ops/build.sh" "$@"
