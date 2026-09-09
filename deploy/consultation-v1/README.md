# Consultation V1 deployment package

This directory implements the local, unexposed V1.2/V1.3 package. It restores
the frozen V1.1 `casework` snapshot into a dedicated PostgreSQL volume, serves
only the versioned read surfaces, and uses a separate Keycloak database.

No service declares a host port in normal operation. The `cloudflared` service
is disabled unless the `publish` profile is selected; publication belongs to
V1.4.

## Prepare

Complete the repository's
[`Cloudflare and SMTP setup checklist`](../../docs/TODO-consultation-v1-cloudflare-and-smtp.md)
before finalizing the candidate environment's `.env` or enabling public ingress.

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

For Rancher Desktop on Windows, enable application auto-start and background
startup. Container `restart: unless-stopped` policies do not start the Rancher
Desktop Docker engine itself. After a Windows reboot, the public service cannot
recover until the deployment user logs in and Rancher Desktop starts. Confirm
all service health and the `cloudflared` connector before declaring recovery;
an inactive connector produces Cloudflare error 1033.

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

Keycloak administration uses an explicit local maintenance mode. Stop public
ingress before entering it, recreate only Keycloak with
`compose.admin-local.yml`, and open
`http://localhost:${AUTH_ADMIN_LOCAL_PORT:-8088}/admin/`:

```powershell
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml --profile publish stop cloudflared
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml -f deploy/consultation-v1/compose.admin-local.yml up -d --no-deps --force-recreate keycloak
```

The override binds Keycloak to `127.0.0.1` and makes both its frontend and admin
URLs local so the master-realm login completes without public ingress. After
administration, restore normal Keycloak configuration before restarting the
Tunnel:

```powershell
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml up -d --no-deps --force-recreate keycloak
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml --profile publish up -d cloudflared
```

Do not use maintenance mode while public consultation is expected to remain
available. The public Cloudflare authentication route must block the `/admin`
and `/realms/master` path prefixes. The public Tunnel has no administration
hostname or route.

## Login admission settings

The API limits unauthenticated login starts before allocating OIDC state. The
defaults permit 10 starts per client and 60 starts globally per 60-second
window. It tracks at most 256 client addresses, retains at most 4,096 pending
logins, and retains at most 2,048 authenticated sessions. A rejected login
returns `429 LOGIN_RATE_LIMITED` with `Retry-After`.

Configure these non-secret settings in `.env` only when measured traffic
requires different bounds:

| Setting | Default | Constraint |
| --- | ---: | --- |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | 60 | Positive integer, at most 3,600 |
| `LOGIN_RATE_LIMIT_PER_CLIENT` | 10 | No greater than the global limit |
| `LOGIN_RATE_LIMIT_GLOBAL` | 60 | Positive integer, at most 10,000 |
| `LOGIN_RATE_LIMIT_MAX_CLIENTS` | 256 | At least twice the global limit and at most 100,000; the oldest active client window is evicted only as a defensive fallback |
| `BFF_LOGIN_STATE_TTL_SECONDS` | 3,600 | First-login state lifetime; positive integer, at most 3,600 |
| `BFF_MAX_PENDING_LOGINS` | 4,096 | Must cover the maximum admitted requests during the configured state lifetime |
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

## New-user onboarding

Use local Keycloak administration to create each user, assign the
`consultation_user` realm role, and set a temporary password. Exit maintenance
mode and restore Keycloak plus Cloudflare Tunnel before sending email; otherwise
Keycloak may generate a loopback action link. From the repository root, request
the verification message with:

```powershell
.\deploy\consultation-v1\Send-VerificationEmail.ps1 -Email "user@example.com"
```

The script refuses to send unless Keycloak has an HTTPS public hostname, the
Tunnel is running, and exactly one enabled unverified user matches the address.
It also binds the email action to the `consultation-web` client so successful
verification returns the browser to the public consultation site. Use `-WhatIf`
to validate those conditions without sending. Wait until Keycloak reports the
address as verified before giving the user the consultation sign-in link. The
user's first application login then changes the temporary password and
configures and confirms TOTP.

As a fallback for users who start login before verification, required actions
run in this order: verify email, change password, configure TOTP. Keycloak and
the BFF retain that first-login transaction for 60 minutes. An expired callback
returns to an explicit restart screen; completed password, email, or confirmed
TOTP actions remain saved.

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
