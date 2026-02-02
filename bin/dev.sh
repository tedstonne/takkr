#!/bin/bash

# Start caddy if not running
pgrep caddy > /dev/null || caddy start --config Caddyfile

# Build CSS initially
bun run build:css

# Start CSS watcher in background
bun run css &
CSS_PID=$!

# Stop caddy and CSS watcher on exit
trap "caddy stop 2>/dev/null; kill $CSS_PID 2>/dev/null" EXIT

# Run bun with hot reload
bun --hot index.tsx
