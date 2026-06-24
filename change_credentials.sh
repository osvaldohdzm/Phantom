#!/bin/bash
# Alias — usa ./change.sh
exec "$(cd "$(dirname "$0")" && pwd)/change.sh" "$@"
