# Setup

Last updated: 2026-09-08

## Authority

This document is the operational source of truth for setup instructions
that are currently supported by the repository and are intended to work
today.

Use this document for:

* required local services and runtimes;
* environment variables and ports;
* database bootstrap behavior;
* importer startup;
* consultation startup;
* current processing prerequisites.

Do not use this document for speculative portability plans or future
automation ideas. Those belong in `docs/TODO-setup-and-portability.md`.

## Documentation Maintenance Policy

Any change that adds, removes, upgrades, relocates, or materially
changes a runtime prerequisite, external executable, service,
environment variable, storage requirement, database bootstrap step,
processor dependency, port, or startup procedure must update this file
in the same change.

## Current Deployment Shape

The current repository uses a mixed local-first setup:

* Docker Compose:
  * PostgreSQL
  * Directus
  * binary gateway
* Local Node.js:
  * importer CLI
  * consultation API
  * consultation UI dev server
* Local Python and external CLI tools:
  * processing worker
  * Docling
  * Xberg
  * PDF evidence extraction tools

This repository does not currently provide a one-command local startup
or a fully automated clean-machine installer.

## Known Prerequisites

### Core

Required for the current consultation/import setup:

* Docker with `docker compose`
* Node.js with `npm`
* a local `.env` file at the repository root

### Environment File

Create `.env` from `.env.example` and provide values for:

* `POSTGRES_DB`
* `POSTGRES_USER`
* `POSTGRES_PASSWORD`
* `DIRECTUS_SECRET`
* `DIRECTUS_ADMIN_EMAIL`
* `DIRECTUS_ADMIN_PASSWORD`

The application code also honors standard PostgreSQL environment
variables such as `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and
`PGPASSWORD` when present.

### Node Dependencies

Install root dependencies from the repository root:

```powershell
npm install
```

Install UI dependencies:

```powershell
npm --prefix .\ui install
```

The root package currently provides:

* `npm run import:package`
* `npm run start:consultation`
* `npm run start:ui`
* `npm run process:c3:worker`
* `npm run process:c3:admin`
* `npm run db:migrate:reference-search`
* `npm run reference:index:pilot`
* `npm run reference:lookup -- --value <reference>`
* `npm run search:pilot -- --query "<terms>"`

### Optional Processing Dependencies

Processing is optional for basic database import and consultation, but
it is required for representation and evidence extraction work.

The current processing path expects a local Python virtual environment
at:

```text
.venv-processing\Scripts\python.exe
```

The current processing requirements file is:

```text
requirements-processing.txt
```

Create the virtual environment and install the Python dependencies:

```powershell
python -m venv .venv-processing
.\.venv-processing\Scripts\python.exe -m pip install -r .\requirements-processing.txt
```

The repository currently declares:

* `docling[rapidocr]==2.123.1`
* `xberg==1.0.14`

### External Processor Executables

The current repository code expects these executables on the local
machine `PATH` when the corresponding processors run:

* `pdftotext`
* `pdfinfo`
* `qpdf`

The repository currently verifies their use in code, but it does not
yet provide a canonical automated installer for them.

## Current Ports And Endpoints

Current repository defaults:

* PostgreSQL: `5432`
* Directus: `8055`
* binary gateway: `8090`
* consultation API: `8091`
* UI dev server: `5173`

Useful endpoints:

* Directus: `http://localhost:8055`
* gateway health: `http://localhost:8090/health`
* gateway binary route: `http://localhost:8090/binary/<sha256>`
* consultation API health: `http://localhost:8091/health`
* fixture reference lookup: `http://localhost:8091/api/consultation/reference-pilot/references/<value>`
* text search: `http://localhost:8091/api/consultation/reference-pilot/search?q=<terms>&scope=pilot|full&sort=relevance|earliest_occurrence_asc|latest_occurrence_desc`

Run the read-only metadata-reference inventory with:

```powershell
npm run reference:inventory
```

It prints structured JSON and does not ingest observations or modify the
database. Add `-- --include-overlap-details` only when the complete, potentially
large normalization-collision and contextual-overlap groups are required.

The text-search endpoint defaults to `scope=pilot`. `scope=full` searches the
current indexed segment corpus. Exact-reference lookup remains fixture-scoped;
full text-search coverage does not imply full reference-observation coverage.
Text-search continuation uses zero-based `offset=<binary groups already returned>`
with the same query, scope, sort, and binary limit. The response reports
`next_offset` and `has_more`; offset pagination assumes the search projection is
not reindexed during the browsing session.
* UI dev server: `http://localhost:5173`

The UI dev server currently proxies:

* `/api` to `http://127.0.0.1:8091`
* `/binary` to `http://127.0.0.1:8090`

## Storage Assumptions

Current repository storage assumptions:

* PostgreSQL data volume:
  * `data/postgres`
* Directus uploads volume:
  * `data/storage`
* imported packages:
  * `data/imports/<package_id>/`
* processing artifacts:
  * `data/exports/processing/`
* processing runtime caches and temp data:
  * `data/processing-runtime/`

Original binaries are currently resolved from imported package storage
through:

* `file_binary.storage_package_id`
* `file_binary.storage_rel_path`
* `BinaryStore` / `LocalBinaryStore`

This means the current original-binary serving and processing paths
assume that imported package files remain available under
`data/imports/`.

## Database Bootstrap

The current Docker Compose file defines:

* PostgreSQL service `virgilio-case-db`
* bootstrap SQL mounted from `db/init/`

Directus uses the PostgreSQL search path `casework,public`. This exposes the
application schema to Directus while retaining access to Directus system tables
in `public`.

Current behavior:

* on first PostgreSQL initialization against an empty
  `data/postgres` volume, `db/init/001-bootstrap.sql` is applied by the
  PostgreSQL container entrypoint;
* on subsequent starts against an already initialized `data/postgres`
  volume, bootstrap SQL does not rerun automatically.

The repository also contains incremental PostgreSQL migrations under
`db/migrations/` for already initialized databases.

This repository does not yet provide one canonical migration-runner
command for existing databases.

The bounded reference/search pilot does provide a narrow idempotent command for
its own migration:

```powershell
npm run db:migrate:reference-search
```

After applying it, seed the frozen pilot fixture with:

```powershell
npm run reference:index:pilot
```

This seed is intentionally limited to the fixture under
`test/fixtures/reference-index-pilot.json`; it does not index or classify the
full corpus. Exact reference lookup and fixture-only text search are available
through the commands listed in the Node dependencies section above.

Corpus-wide court-metadata reference ingestion uses a separate command. It is
read-only by default and prints the proposed lifecycle changes:

```powershell
npm run reference:index:metadata
```

After reviewing that output, apply it transactionally with:

```powershell
npm run reference:index:metadata -- --write
```

The command covers recorded case, occurrence, and source-document reference
fields. It does not expand document-text citation extraction or enable the
later corpus-wide API/UI mode.

## Verified Current Startup Path

### 1. Start Docker services

From the repository root:

```powershell
docker compose up -d db directus gateway
```

This starts:

* PostgreSQL
* Directus
* the binary gateway

### 2. Install local Node dependencies

From the repository root:

```powershell
npm install
npm --prefix .\ui install
```

### 3. Import a package

Place a portable package under:

```text
data/imports/<package_id>/
```

Then run:

```powershell
npm run import:package -- data/imports/<package-dir>
```

The importer reads package files from disk and writes canonical rows
into PostgreSQL. It does not start processing workers automatically.

### 4. Start the consultation API

From the repository root:

```powershell
npm run start:consultation
```

The consultation API listens on `8091` by default.

### 5. Start the UI

From the repository root:

```powershell
npm run start:ui
```

The UI dev server listens on `5173` by default and proxies requests to
the local consultation API and binary gateway.

### 6. Optional read-only text-consultation MCP (v1 MVP)

The optional local stdio MCP exposes a no-data connection check through
`hello`, and existing text consultation through `search_document_text`, `get_binary_details`, and
`get_representation_content`, plus the occurrence-centred court metadata read
model through `query_court_records`. It does not expose recorded-reference lookup,
graphs, reviews, ingestion, writes, or original-binary downloads. Binary detail
retains the canonical SHA-256 identity but omits the consultation UI's local
download URL.

Configure an MCP client to run this command from the repository root:

```powershell
npm run start:mcp:text-consultation
```

The process communicates over standard input/output and therefore does not
listen on a TCP port. It loads the same `.env` PostgreSQL settings as the
consultation API. Keep standard output reserved for MCP protocol messages;
startup and query failures are written to standard error.

This is a disposable v1 experiment. Its tool and response contracts may be
replaced or removed, and it is not a foundation for write-oriented workflows.

#### Private Streamable HTTP over Tailscale

The same four tools can be served remotely through a private Streamable HTTP
endpoint. The HTTP server binds to `127.0.0.1:8092` by default and requires a
bearer token of at least 32 characters. Add these uncommitted secrets to the
repository-root `.env`:

```text
TEXT_CONSULTATION_MCP_HTTP_TOKEN=<random secret of at least 32 characters>
TEXT_CONSULTATION_MCP_HTTP_HOST=127.0.0.1
TEXT_CONSULTATION_MCP_HTTP_PORT=8092
TEXT_CONSULTATION_MCP_HTTP_ALLOWED_HOSTS=localhost,127.0.0.1,<device>.<tailnet>.ts.net
TEXT_CONSULTATION_MCP_LOG_PATH=data/processing-runtime/text-consultation-mcp-http.log
```

The log path is optional; the shown ignored runtime path is the default. The
server writes JSON Lines operational records there and to standard error. Logs
include timestamps, routes or tool names, durations, statuses, and sanitized
error details. They do not include bearer tokens, query strings, tool
arguments, search text, or document content.

Start the private HTTP process:

```powershell
npm run start:mcp:text-consultation:http
```

The endpoint is `http://127.0.0.1:8092/mcp`. Do not bind it to `0.0.0.0` or
expose this port through the public router. Use Tailscale Serve to publish that
localhost endpoint as private tailnet HTTPS, and configure the allowed-host
entry to match the generated `*.ts.net` hostname. The bearer token remains
required in addition to Tailscale network access.

On the remote Codex client, store the token in a local environment variable and
register the private URL using that variable rather than embedding the token in
the Codex configuration:

```powershell
codex.cmd mcp add virgilio-text-consultation --url https://<device>.<tailnet>.ts.net/mcp --bearer-token-env-var VIRGILIO_MCP_TOKEN
```

The host computer, PostgreSQL, HTTP MCP process, and Tailscale Serve must remain
running while the remote client is using the tools. PostgreSQL and the binary
gateway are not exposed to the tailnet by this setup.

## Current Processing Startup

Processing is not part of normal consultation startup.

Start a worker only when processing is intended:

```powershell
npm run process:c3:worker
```

Administrative inspection/enqueue commands are available through:

```powershell
npm run process:c3:admin -- <command> [flags]
```

The repository does not currently provide a single documented
high-level command that:

* verifies all processor prerequisites;
* installs missing dependencies;
* seeds processing backlog;
* starts workers safely.

## Current Processor-Specific Prerequisites

### `pdf_literal_text`

Requires:

* `pdftotext` on `PATH`

### `pdf_signature_metadata`

Requires:

* `qpdf` on `PATH`

### `pdf_structure_inventory`

Requires:

* `pdfinfo` on `PATH`
* `qpdf` on `PATH`
* `pdftotext` on `PATH`

### `docling`

Requires:

* `.venv-processing\Scripts\python.exe`
* installed `docling[rapidocr]`

### `xberg`

Requires:

* `.venv-processing\Scripts\python.exe`
* installed `xberg`

### `pdf_ocr_text`

Requires:

* `.venv-processing\Scripts\python.exe`
* installed `docling[rapidocr]`

Current processing runtime behavior also defaults to offline model use
by setting:

* `HF_HUB_OFFLINE=1`
* `TRANSFORMERS_OFFLINE=1`

The runtime also sets `DOCLING_ARTIFACTS_PATH` to the repository-local
model directory by default:

* `data/processing-runtime/cache/docling/models`

Set `DOCLING_ARTIFACTS_PATH` explicitly only when the prepared Docling
model directory is stored elsewhere.

through the runtime environment builder unless those variables are
already set.

This means Docling/OCR processing currently assumes the necessary local
model assets are already available. The repository does not yet provide
a documented reproducible model-cache bootstrap workflow.

## Known Current Gaps

### Optional PTDocs enrichment review area

The existing Node/`pg` and PostgreSQL setup supports isolated external staging.
Apply explicitly with the configured administrative connection (role/schema/table
creation and grants required); this is not part of automatic database bootstrap:

```powershell
node app/ptdocs-review.mjs setup
node app/ptdocs-review.mjs stage data/exports/ptdocs-reconciliation/2026-09-04
node app/ptdocs-review-assess.mjs 1 data/exports/ptdocs-review/2026-09-04
node app/ptdocs-review.mjs findings 1 data/exports/ptdocs-review/2026-09-04/sample-findings.json
node app/ptdocs-review.mjs findings 1 data/exports/ptdocs-review/2026-09-04/package-findings.json
node app/ptdocs-review-check.mjs
```

Use the batch ID returned by `stage`, not a hard-coded `1` on other databases.
`setup` applies `db/migrations/2026-09-04-014-ptdocs-review.sql`, creates a NOLOGIN
reviewer role and four append-only staging tables, and checks canonical UPDATE
denial. Subsequent commands switch to that role; the session login must be allowed
to `SET ROLE ptdocs_reviewer` (the current administrator can). This does not create
a separate credential or remove the administrator's own privileges.

The loader consumes an already prepared reconciliation snapshot, not arbitrary
XLSX files: `source-manifest.json`, `staged-rows.json`, `staged-binaries.json`,
`row-matches.json`, `summary.json`, `sheets.json`. Identical input digests reuse the
existing batch. The September snapshot and case-specific extraction scripts are
local, git-ignored artifacts, not a portable workbook import pipeline. Preserve
them in backups along with PostgreSQL. Source rows and findings live in the DB;
rendered inspection pages live only in the local evidence directory. The staged
rows JSON is approximately 108 MB and the loader reads it into memory.

Assessment uses existing representations and does not run corpus extraction.
Manual source-page inspection used existing Poppler `pdftoppm`; reproducing those
renders requires that executable. No new model or OCR prerequisite was added.
The integration check rolls back its test rows, though identity sequences can
advance. There is no UI integration, automatic canonical promotion or cleanup job.
See `docs/architecture/14-ptdocs-enrichment-review.md` for boundaries.

For the full-set package pass against an existing review batch:

```powershell
node app/ptdocs-package-snapshot.mjs 1 data/exports/ptdocs-packages/2026-09-04
node app/ptdocs-package-map.mjs data/exports/ptdocs-packages/2026-09-04
node app/ptdocs-package-review.mjs data/exports/ptdocs-packages/2026-09-04
node app/ptdocs-package-check.mjs data/exports/ptdocs-packages/2026-09-04
node --test app/ptdocs-package-parser.test.mjs
```

Use a new output directory for a new evidence snapshot. The snapshot step requires
the recorded external source directory to be readable and unchanged, plus access
to canonical binaries through BinaryStore. It verifies both source workbooks and
all supplied/canonical file hashes. It reads existing representations; it does not
schedule OCR or alter preferred representations. The subsequent map/review/check
commands operate on local snapshot files without database writes. Outputs for the
September pass occupy approximately 175 MB, including local QA artifacts.

To persist reviewed findings, use the existing findings command with the relevant
batch ID. For this completed pass the files are `complete-findings.json` and
`supplemental-findings.json` under the package output directory. The generic
`package-findings.json` contains automated row/manifest results only; combined
package, coverage and visual findings were added during the case-specific review.
Those manual findings cannot be regenerated by claiming an automated review.
Repeated identical payloads deduplicate; different assessments remain appended.

The optional recovered-image QA used bundled Python with pypdf 6.10.0 and Pillow
12.3.0 to compare decoded images, plus Poppler for page views. This does not install
new application runtime dependencies. A pixel mismatch remains explicitly separate
from visually supported derivative correspondence. Keep these git-ignored local
artifacts in backups; persisted findings retain source lineage and evidence text.

### Original court scrape cross-check

For a read-only comparison with the extracted original court scrape and upload,
run the following with Python 3.11 or later (standard library only):

```powershell
python app/ptdocs-original-audit.py C:/repos/PTDocs/attila_originalScrapes data/exports/ptdocs-packages/2026-09-04 data/exports/ptdocs-original-audit/2026-09-04
```

Use an available Python executable's full path if `python` is not on PATH. The
first argument is a configurable read-only source directory containing the two
extracted package folders. Archives are ignored. The second argument must contain
the earlier `inventory.json` and `row-review.json` snapshots; the third receives
derived JSON artifacts. No database connection or PDF extraction is performed.
Use a fresh output directory for a new snapshot. HTML row positions are retained
as observations only; the site rendering order was not stable.

### Saved Citius HTML provenance import

The importer records `metadata_json.adapter` (`citius-saved-html`, version `1`)
on the source capture. Reusing a verified legacy capture adds only that missing
descriptor; no schema migration is needed for this addition. The configured login
needs UPDATE on `source_capture` for this metadata backfill. Unknown existing
adapter identities are rejected. Focused validation:

```powershell
node --test app/citius-html-payload.test.mjs
```

Before running the HTML importer against an existing database, apply the execution
header/source-time migration once (replay is supported):

```powershell
node app/apply-import-execution-migration.mjs
node --test app/import-execution.test.mjs
```

This applies `2026-09-05-015-import-execution.sql`, adds `import_execution`, and
separates source timing from the old HTML registration timestamp while retaining
history. The configured migration connection needs table-owner/DDL rights. Fresh
database bootstrap includes the same schema. Regular HTML imports additionally
need INSERT/SELECT/UPDATE and sequence access on `import_execution`. No new runtime
dependency or service is introduced. See [timing semantics](architecture/19-import-execution-and-source-time.md).

Requires Python 3.11+ (standard library), the existing Node/pg dependencies and
configured PostgreSQL connection. Run against the extracted multicase HTML folder,
not its parent upload/download directories. Use a new snapshot output path:

```powershell
python app/citius-html-snapshot.py C:/repos/PTDocs/attila_originalScrapes/tribunais-multicase-audit-2026-08-29T22-50-36-257Z data/exports/citius-html/2026-09-05/snapshot.json
node app/citius-html-import.mjs data/exports/citius-html/2026-09-05/snapshot.json data/exports/citius-html/2026-09-05/report.json
python app/citius-html-snapshot-test.py
```

Use Python's full executable path if it is not on PATH. The import uses existing
provenance tables and configured DB login with SELECT on court records and
INSERT/SELECT plus sequence access on the three provenance tables. The restricted
PTDocs reviewer role cannot perform it. Migration 015 is required; no additional
grant change is needed for the verified current configured login. Repeating the Node command reuses the
same capture; changed parsing for the same manifest is rejected. Raw HTML bytes
are retained in PostgreSQL as base64 and in the local snapshot; back up both.
This command does not update canonical court fields. See the
[provenance contract](architecture/16-saved-citius-html-provenance.md) for scope.

### Consultation V1 release-input verification

The Consultation V1 frozen inputs and contracts live under
`release/consultation-v1/`. The unexposed Docker runtime and identity package
lives under `deploy/consultation-v1/`; it is separate from the development
runtime described above.

Create a PostgreSQL custom-format backup of the `casework` schema and keep it in
the ignored `data/releases/consultation-v1/` directory. Then generate and verify
the complete source-package, representation-artifact, schema, contract, and
database inventories:

```powershell
npm run release:v1:contracts
npm run release:v1:inventory -- --database-snapshot data/releases/consultation-v1/consultation-v1-input.dump
npm run release:v1:verify -- --database-snapshot data/releases/consultation-v1/consultation-v1-input.dump
```

The database account used by these commands needs `SELECT` access to the
`casework` schema. The snapshot must contain `casework` only; do not include the
isolated `ptdocs_review` schema or identity-provider data. The backup itself is
not committed. Its size and SHA-256 identity are recorded in the generated
manifest.

### Consultation V1 unexposed Docker package

V1.2/V1.3 require Docker Engine with Compose. They do not require the host
Node, Python, PDF, OCR, Directus, importer, processor, or model-cache runtime.
The pinned images are Node 24.19.0 Bookworm slim, nginx 1.28.3 Alpine,
PostgreSQL 17.11 Bookworm, Keycloak 26.7.3, and cloudflared 2026.8.3. The
cloudflared service remains disabled until the V1.4 `publish` profile is used.
Complete the dedicated
[Cloudflare and SMTP setup checklist](TODO-consultation-v1-cloudflare-and-smtp.md)
before finalizing the candidate environment's `.env` and enabling that profile.

Prepare configuration and secret files from the repository root:

```powershell
Copy-Item deploy/consultation-v1/.env.example deploy/consultation-v1/.env
./deploy/consultation-v1/generate-secrets.ps1
```

Edit the ignored `.env` with exact public URLs and existing read-only host
paths. Put the SMTP credential in the generated ignored
`deploy/consultation-v1/secrets/smtp_password.txt`. The immutable database dump
remains `data/releases/consultation-v1/consultation-v1-input.dump` by default.
The API uses `API_PUBLIC_URL` and OIDC discovery to materialize its served
OpenAPI document. Invalid, nonpositive, or excessive token/session duration
settings stop the API or MCP process at startup.
Within Compose, API and MCP reach Keycloak through the private
`http://keycloak:8080` backchannel while retaining the exact public issuer for
token validation and browser authorization. This lets the unexposed topology
become healthy before Cloudflare Tunnel starts.
Protected remote administration support is prepared but not verified live.
Follow [the activation runbook](../deploy/consultation-v1/ADMIN-HOSTNAME.md)
before setting optional `KEYCLOAK_ADMIN_URL`. Without it, the local procedure
below remains the verified setup. A persisted master frontend URL must be
cleared before returning to local administration; the Compose override alone
does not clear that realm setting.

Keycloak administration uses `deploy/consultation-v1/compose.admin-local.yml`
as a local maintenance override. Normal operation maps no host ports. Before
using the override, stop `cloudflared`; the override binds Keycloak to
`127.0.0.1:8088` by default and makes both its frontend and administration URLs
local so master-realm authentication remains on loopback. Restore Keycloak with
the base Compose file before restarting public ingress. This is not a general
local API profile and must not be rebound to a LAN or wildcard address. Public
Cloudflare ingress exposes only the Keycloak login/account surface and must
block the `/admin` and `/realms/master` path prefixes on the authentication
hostname. See the deployment README for the exact enter/exit commands.

### Consultation V1 new-user onboarding

Enter local Keycloak maintenance mode and create an enabled user with the
correct email address. Assign the `consultation_user` realm role and add the
`Update Password` and `Configure OTP` required actions. Do not create or
distribute a temporary password: the signed invitation establishes the one-time
setup session in which the user creates a password and configures TOTP. Restore
normal public mode and Cloudflare Tunnel before requesting the verification
message; sending from maintenance mode can produce a loopback action link. Run
`deploy/consultation-v1/Send-VerificationEmail.ps1 -Email
"user@example.com"` from the repository root. The script checks the public
Keycloak hostname, running Tunnel, and exact unverified user before sending;
it binds the action to `consultation-web` and returns successful verification
to `SITE_PUBLIC_URL`. `-WhatIf` performs the checks without sending. Confirm
that Keycloak reports `Email verified` before giving the user the public URL.

The invitation flow creates the password and then configures and confirms TOTP.
If an unverified user starts login early, Keycloak's fallback order is email
verification, password creation, then TOTP. Login and user-action
state last 60 minutes; an administrator-issued verification link lasts 12
hours. Access tokens remain limited to five minutes and the final authorization
code remains limited to 60 seconds.

The release UI checks `/api/v1/auth/session` before mounting any consultation
layout or document component. A missing session shows only the neutral sign-in
transition. Expired onboarding callbacks show a restart message and state that
completed actions remain saved.

The login-admission and BFF-capacity settings in `.env.example` have validated
defaults. The first-login state is retained for 60 minutes and the default
pending-login capacity is 4,096. Invalid combinations stop API startup. The origin must remain
reachable only through the tunnel because the API accepts Cloudflare's
`CF-Connecting-IP` as the public client address. See the deployment README for
the complete setting constraints and required cache-bypass rule.
Then build and start without public ingress:

```powershell
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml build
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml up -d
docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml ps
```

On a Windows deployment host using Rancher Desktop, enable **Start Rancher
Desktop when you log in** and **Start in the background** under Rancher
Desktop's application behavior settings. The equivalent CLI operation is:

```powershell
rdctl set --application.auto-start --application.start-in-background
```

Compose restart policies can restart the containers only after the Rancher
Desktop Docker engine is running. If Windows restarts while Rancher Desktop
auto-start is disabled, every public route remains configured in Cloudflare but
the Tunnel has no connector; visitors receive Cloudflare error 1033. Rancher
Desktop auto-start occurs at user login, so the service remains unavailable
between a machine reboot and that Windows user's login. After a reboot, verify
that Docker is reachable, every service is healthy, and `cloudflared` is
running before treating the public service as restored.

The base topology maps no host ports. It restores the `casework` snapshot only
on first creation of its dedicated volume
and imports the secret-free Keycloak realm only when the realm is absent. Keep
production volumes, secrets, hostnames, and Compose project name separate from
development. See
`deploy/consultation-v1/README.md` for secret rotation and backup boundaries.

### UI proxy after API replacement

The UI nginx upstream resolves `api` through Docker's embedded DNS
(`127.0.0.11`, five-second validity), so replacing the API container does not
leave the UI proxy using its old address. This uses nginx's
[dynamic upstream resolution](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve)
supported by the pinned nginx version. Deploy proxy configuration changes by
rebuilding and recreating `ui`; check `/api/v1/health` through the UI proxy,
not only directly against the API. The latter can succeed while the proxy
returns 502.

### Native PDF viewer delivery

All PDFs use the browser's native PDF viewer in a same-origin iframe.
The UI proxy therefore returns `frame-ancestors 'self'` only for authenticated
`/api/v1/binaries/{sha256}/content` responses. Other UI and API responses retain
`frame-ancestors 'none'`. If the native viewer shows a broken-document icon
while the content request returns `200`, verify this path-specific CSP header.

### Codex hosted MCP connection

For end users, share [Connect to Virgilio Consultation](MCP-CLIENT-HOWTO.md),
which covers ChatGPT and Codex without deployment credentials.

Create `consultation-codex` from
`deploy/consultation-v1/keycloak/codex-client.json` through authenticated
Keycloak administration and assign only `consultation_user` to its realm role
scope mappings. This standalone client template is not a startup realm import.
It is a public client with S256 PKCE and user consent, no application secret,
no password/service-account grants and no offline access.

Add the snippet in `deploy/consultation-v1/codex-hosted.toml` to each computer's
user Codex `config.toml`. The callback is exactly
`http://127.0.0.1:8787/callback`, with listener port 8787; that port must be free
during login. The identity provider advertises issuer identification, allowing
Codex to use the fixed pre-registered callback. The same client registration
works on multiple computers; each user signs in separately and credentials
stay in Codex's OAuth credential store on that computer.

Leave `oauth_resource` unset: Codex obtains it from protected-resource
discovery. Setting it explicitly with the currently installed CLI duplicates
the `resource` parameter and Keycloak rejects login as `invalid_request`.

Run `codex mcp login virgilio-hosted --scopes openid,consultation.read` and
complete browser login and consent. Reload Codex/start a new task to load the
hosted tools. `codex mcp logout virgilio-hosted` removes local authorization.
The existing `virgilio-text-consultation` local connection is separate.

### ChatGPT MCP client registration

Use **User-Defined OAuth Client** in ChatGPT. Anonymous dynamic registration
remains restricted by Keycloak's Trusted Hosts policy. The dedicated client
template is `deploy/consultation-v1/keycloak/chatgpt-client.json`; create it in
the `consultation` realm through authenticated administration, then add only
the `consultation_user` realm role to its role scope mappings. The template is
not automatically imported with the realm. Keycloak generates its client
secret. Compose mounts only `consultation-realm.json` into the startup import
directory: standalone client templates must not be mounted there, because
Keycloak parses every import JSON file as a realm. Keep the client
secret in the operator's ignored `secrets/` directory and enter it
only in ChatGPT's Client Secret field.

Client ID: `consultation-chatgpt`. Callback allowlist:
`https://chatgpt.com/connector_platform_oauth_redirect`, confirmed by the app
creator. ChatGPT requests `openid offline_access consultation.read`. The client
requires S256 PKCE, user consent and the existing invited-user login; it grants
the MCP audience, not the API audience. Password grants and service accounts
are disabled. The user-approved ChatGPT exception (2026-09-09) attaches the
existing `offline_access` scope as optional. Its realm role is inherited by
default users; keep that role in the offline scope's role mappings. Set realm
`offlineSessionIdleTimeout=1800`, `offlineSessionMaxLifespanEnabled=true` and
`offlineSessionMaxLifespan=28800`, plus the same client limits through
`client.offline.session.idle.timeout` and `client.offline.session.max.lifespan`.
The realm ceiling must permit eight hours; other consultation clients do not
have the offline scope. Keep five-minute access tokens and refresh rotation.
These live settings must also be applied to existing realms and clients;
changing the templates alone does not update them.

Offline access survives browser logout. Users can revoke the ChatGPT grant in
the Keycloak Account Console's applications area; administrators can revoke
the user's client consent/offline sessions. Already issued access tokens can
remain valid for up to five minutes. After 30 minutes idle or eight hours
maximum, ChatGPT must authorize again. A changed callback URL
requires an explicit client allowlist update.

### Browser logout and application title

The `consultation-web` Keycloak client must allow exactly
`${SITE_PUBLIC_URL}/signed-out` in its `post.logout.redirect.uris` attribute.
The realm template includes this setting; existing realms require the same
live client update because startup import does not modify existing clients.
The header's Log out button submits a same-origin POST and redirects to
Keycloak's logout confirmation. Completing it ends that browser's SSO session
and returns to `/signed-out`, which offers an explicit Sign in button.
Logout remains available after BFF expiry or restart. Same-origin tabs receive
a storage event to leave document views where browser storage is available;
server-side logout does not depend on storage events.

Set `VITE_APP_TITLE` in the deployment `.env` to configure the header and browser
tab title. It defaults to `Virgilio Consultation - beta v1`. This is a UI build
argument: rebuild and recreate `ui` after changing it.

### Keycloak subject claim

The custom Keycloak `consultation.read` scope must include the standard
`Subject (sub)` protocol mapper (`oidc-sub-mapper`), with access-token and
introspection inclusion enabled. Keycloak 26 does not supply the access-token
subject automatically when the built-in `basic` scope is omitted. The realm
template includes this mapper. Existing realms must add it through Keycloak
administration: startup import does not update an existing realm. Missing `sub`
previously surfaced as `INVALID_ID_TOKEN` / `subject_mismatch` at the browser
callback; access-token validation now rejects a missing subject directly.
After changing the mapper, start a fresh login to obtain newly issued tokens.

### Remaining setup gaps

The following are not yet fully documented as reproducible end-to-end
setup paths:

* installing `pdftotext`, `pdfinfo`, and `qpdf` on Windows;
* preparing Docling/OCR model caches for offline use;
* migrating an already populated Virgilio instance to another machine;
* one-command setup or environment diagnostics;
* one canonical migration procedure for an existing non-empty database.

Those gaps are tracked in `docs/TODO-setup-and-portability.md`.
