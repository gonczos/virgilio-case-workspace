#!/bin/sh
set -eu

read_secret() {
  variable="$1"
  file="/run/secrets/$2"
  if [ -f "$file" ]; then
    value=$(cat "$file")
    export "$variable=$value"
  fi
}

if [ -n "${PGPASSWORD_SECRET:-}" ]; then
  read_secret PGPASSWORD "$PGPASSWORD_SECRET"
fi
read_secret INTERNAL_GATEWAY_TOKEN internal_gateway_token
read_secret OIDC_CLIENT_SECRET oidc_client_secret

exec "$@"
