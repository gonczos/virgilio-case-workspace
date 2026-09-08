#!/bin/sh
set -eu

pg_restore --exit-on-error --no-owner --no-acl --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" /release-input/consultation-v1-input.dump

api_password=$(cat /run/secrets/api_db_password)
mcp_password=$(cat /run/secrets/mcp_db_password)
gateway_password=$(cat /run/secrets/gateway_db_password)

psql --set=ON_ERROR_STOP=1 --set=api_password="$api_password" --set=mcp_password="$mcp_password" --set=gateway_password="$gateway_password" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE consultation_v1_api LOGIN PASSWORD %L', :'api_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'consultation_v1_api') \gexec
SELECT format('CREATE ROLE consultation_v1_mcp LOGIN PASSWORD %L', :'mcp_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'consultation_v1_mcp') \gexec
SELECT format('CREATE ROLE consultation_v1_gateway LOGIN PASSWORD %L', :'gateway_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'consultation_v1_gateway') \gexec

GRANT CONNECT ON DATABASE consultation_v1 TO consultation_v1_api, consultation_v1_mcp, consultation_v1_gateway;
GRANT USAGE ON SCHEMA casework TO consultation_v1_api, consultation_v1_mcp, consultation_v1_gateway;
GRANT SELECT ON ALL TABLES IN SCHEMA casework TO consultation_v1_api, consultation_v1_mcp, consultation_v1_gateway;
ALTER DEFAULT PRIVILEGES IN SCHEMA casework GRANT SELECT ON TABLES TO consultation_v1_api, consultation_v1_mcp, consultation_v1_gateway;
ALTER ROLE consultation_v1_api SET default_transaction_read_only = on;
ALTER ROLE consultation_v1_mcp SET default_transaction_read_only = on;
ALTER ROLE consultation_v1_gateway SET default_transaction_read_only = on;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
