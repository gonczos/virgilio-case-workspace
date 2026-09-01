# Setup

Last updated: 2026-09-01

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
* consultation API health: `http://127.0.0.1:8091/health`
* UI dev server: `http://127.0.0.1:5173`

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

through the runtime environment builder unless those variables are
already set.

This means Docling/OCR processing currently assumes the necessary local
model assets are already available. The repository does not yet provide
a documented reproducible model-cache bootstrap workflow.

## Known Current Gaps

The following are not yet fully documented as reproducible end-to-end
setup paths:

* installing `pdftotext`, `pdfinfo`, and `qpdf` on Windows;
* preparing Docling/OCR model caches for offline use;
* migrating an already populated Virgilio instance to another machine;
* one-command setup or environment diagnostics;
* one canonical migration procedure for an existing non-empty database.

Those gaps are tracked in `docs/TODO-setup-and-portability.md`.
