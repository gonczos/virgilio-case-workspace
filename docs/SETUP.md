# Setup

Last updated: 2026-09-03

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

The optional local stdio MCP exposes existing text consultation through
`search_document_text`, `get_binary_details`, and
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

### Remaining setup gaps

The following are not yet fully documented as reproducible end-to-end
setup paths:

* installing `pdftotext`, `pdfinfo`, and `qpdf` on Windows;
* preparing Docling/OCR model caches for offline use;
* migrating an already populated Virgilio instance to another machine;
* one-command setup or environment diagnostics;
* one canonical migration procedure for an existing non-empty database.

Those gaps are tracked in `docs/TODO-setup-and-portability.md`.
