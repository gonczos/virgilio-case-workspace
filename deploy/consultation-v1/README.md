# Consultation V1 deployment package

This directory implements the local, unexposed V1.2/V1.3 package. It restores
the frozen V1.1 `casework` snapshot into a dedicated PostgreSQL volume, serves
only the versioned read surfaces, and uses a separate Keycloak database.

No service declares a host port. The `cloudflared` service is disabled unless
the `publish` profile is selected; publication belongs to V1.4.

## Prepare

1. Copy `.env.example` to `.env` and replace every `example.invalid` value.
2. Set the three host paths to the frozen source package, representation
   artifacts, and the V1.1 custom-format database snapshot.
3. Run `./generate-secrets.ps1`. Replace `secrets/smtp_password.txt` with the
   SMTP credential and set the matching non-secret SMTP values in `.env`.
4. Keep `.env` and `secrets/` outside Git and restrict them to the deployment
   operator.

Build and start the unexposed package from the repository root:

```powershell
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml build
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml up -d
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml ps
```

The initial database startup restores the snapshot and creates three distinct
login roles. Each has only `CONNECT`, schema `USAGE`, and table `SELECT`; its
`default_transaction_read_only` setting is also enabled. Original and derived
files are bind-mounted read-only. Importers, processors, migrations, and
Directus are absent from the images and Compose services.

The initial Keycloak startup imports `keycloak/consultation-realm.json`. It
creates no users. Self-registration is disabled; a realm administrator must
later create invited users and grant `consultation_user`. All users must enroll
TOTP on first login. Access tokens last at most five minutes, refresh-token
reuse is zero, and the application accepts only `consultation.read` plus the
correct API or MCP audience.

## Login admission settings

The API limits unauthenticated login starts before allocating OIDC state. The
defaults permit 10 starts per client and 60 starts globally per 60-second
window. It tracks at most 256 client addresses, retains at most 512 pending
logins, and retains at most 2,048 authenticated sessions. A rejected login
returns `429 LOGIN_RATE_LIMITED` with `Retry-After`.

Configure these non-secret settings in `.env` only when measured traffic
requires different bounds:

| Setting | Default | Constraint |
| --- | ---: | --- |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | 60 | Positive integer, at most 3,600 |
| `LOGIN_RATE_LIMIT_PER_CLIENT` | 10 | No greater than the global limit |
| `LOGIN_RATE_LIMIT_GLOBAL` | 60 | Positive integer, at most 10,000 |
| `LOGIN_RATE_LIMIT_MAX_CLIENTS` | 256 | Positive integer, at most 100,000; the oldest active client window is evicted when this bound is reached |
| `BFF_MAX_PENDING_LOGINS` | 512 | Must cover the maximum admitted requests during the five-minute state lifetime |
| `BFF_MAX_SESSIONS` | 2,048 | Positive integer, at most 100,000 |

Client identity uses Cloudflare's validated `CF-Connecting-IP` header and
falls back to the direct socket address for unexposed/local operation. Keep the
origin services private so clients cannot forge that Cloudflare header. The
Cloudflare configuration must still bypass cache for `/api/v1/**` and
`/mcp/v1`, and may add a stricter edge login limit without changing the
application contract.

For initial Google SMTP testing, manage the app password at
<https://myaccount.google.com/apppasswords>. Put only the credential value in
the ignored `smtp_password.txt`; do not add it to `.env`, Compose, realm JSON,
logs, or documentation.

## Secret rotation

Secret files are runtime inputs and image rebuilds are unnecessary. Database
password changes require an operator to run `ALTER ROLE ... PASSWORD ...` in
the matching database before atomically replacing its file and restarting the
affected service. Rotate the BFF client secret in Keycloak before replacing
`oidc_client_secret.txt` and restarting `api`. Replace the internal gateway
token file and restart `gateway` and `api` together. Change SMTP credentials
in Keycloak and the file together. Retain one authenticated administrator
session until each change is verified.

## Data backup and restore

The V1.1 input snapshot is immutable. Back up the live consultation database
separately after any approved release preparation and record its SHA-256 as the
configured release backup. Back up the Keycloak database independently because
it is writable identity state. A clean restore test must use new volumes and
must verify the manifest, read-only role denial, representative API/MCP reads,
and login before V1.5 acceptance.

Do not run `down --volumes` against an accepted deployment unless restoring
from verified backups. Development must use a different Compose project name,
volumes, secrets, hostnames, and data paths.
