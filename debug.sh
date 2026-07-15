#!/usr/bin/env bash
# Phantom Advanced Debug Script - Generates detailed logs for troubleshooting

export NODE_ENV=development
export DEBUG="phantom:*,spectre:*,app:*,express:*,next:*,vis-network:*"
export LOG_LEVEL=debug
export NEXT_DEBUG=true

echo "============================================================"
echo "Starting Phantom in ULTRA VERBOSE DEBUG mode..."
echo "Logs will stream directly to this terminal to catch all events."
echo "============================================================"

# We delegate to the native debug script which runs the frontend and backend 
# interactively with verbose output!
exec "$(cd "$(dirname "$0")" && pwd)/phantom" debug "$@"
