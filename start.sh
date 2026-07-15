#!/usr/bin/env bash
# Compat: delega en ./phantom start
exec "$(cd "$(dirname "$0")" && pwd)/phantom" start "$@"
