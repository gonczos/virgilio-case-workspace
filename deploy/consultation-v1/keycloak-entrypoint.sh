#!/usr/bin/env bash
set -euo pipefail

read_secret() {
  local variable="$1" file="/run/secrets/$2"
  if [[ -f "$file" ]]; then
    printf -v "$variable" '%s' "$(<"$file")"
    export "$variable"
  fi
}

read_secret KC_DB_PASSWORD keycloak_db_password
read_secret KC_BOOTSTRAP_ADMIN_PASSWORD keycloak_bootstrap_password
read_secret OIDC_CLIENT_SECRET oidc_client_secret
read_secret SMTP_PASSWORD smtp_password

exec /opt/keycloak/bin/kc.sh "$@"
