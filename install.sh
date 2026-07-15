#!/usr/bin/env bash
# Compat: delega en ./phantom install
exec "$(cd "$(dirname "$0")" && pwd)/phantom" install "$@"
