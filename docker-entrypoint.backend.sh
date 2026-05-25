#!/usr/bin/env sh
set -eu

# Runtime UID/GID can be injected from host to avoid host path permission drift
APP_UID="${APP_UID:-1001}"
APP_GID="${APP_GID:-1001}"

RUNTIME_PATHS="/app/incoming /app/processed /app/manufacturer-pricebooks/holding /app/board-uploads /app/social-uploads"

for path in $RUNTIME_PATHS; do
  mkdir -p "$path"
  if command -v chown >/dev/null 2>&1; then
    chown "$APP_UID:$APP_GID" "$path" || true
  fi
  if command -v chmod >/dev/null 2>&1; then
    chmod 2775 "$path" || true
  fi
done

if command -v mkdir >/dev/null 2>&1; then
  mkdir -p /opt/venv
fi

if [ "$(id -u)" -eq 0 ] && command -v gosu >/dev/null 2>&1; then
  exec gosu "${APP_UID}:${APP_GID}" "$@"
fi

exec "$@"
