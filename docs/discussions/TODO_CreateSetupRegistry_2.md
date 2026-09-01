## Setup Documentation Checkpoint Result

Date:

2026-09-01

### Outcome

This checkpoint established two separate documentation authorities:

* `docs/SETUP.md`
  * operational setup instructions that are intended to work today
  * repository-backed current behavior only
* `docs/TODO-setup-and-portability.md`
  * unresolved setup, portability, migration, and automation work
  * not an operational instruction source

### Verified Current Repository Shape

The current repository uses a mixed local-first runtime shape:

* Docker Compose services:
  * PostgreSQL
  * Directus
  * binary gateway
* local Node.js entry points:
  * importer
  * consultation API
  * UI dev server
* local Python and external CLI tools:
  * processing worker
  * Docling
  * Xberg
  * PDF evidence extraction tools

This is narrower and more accurate than treating the whole system as one
Dockerized stack or one fully automated local app.

### Verified Current Setup Path

The repository-backed current path is:

1. create `.env` from `.env.example`
2. `docker compose up -d db directus gateway`
3. `npm install`
4. `npm --prefix .\ui install`
5. place a package under `data/imports/<package_id>/`
6. `npm run import:package -- data/imports/<package-dir>`
7. `npm run start:consultation`
8. `npm run start:ui`
9. optionally start `npm run process:c3:worker` only when processing is
   actually intended

### Verified Processor Prerequisites

Repository-backed processor dependency findings:

* `pdf_literal_text`
  * `pdftotext`
* `pdf_signature_metadata`
  * `qpdf`
* `pdf_structure_inventory`
  * `pdfinfo`
  * `qpdf`
  * `pdftotext`
* `docling`
  * `.venv-processing\Scripts\python.exe`
  * `docling[rapidocr]`
* `xberg`
  * `.venv-processing\Scripts\python.exe`
  * `xberg`
* `pdf_ocr_text`
  * `.venv-processing\Scripts\python.exe`
  * `docling[rapidocr]`

Current offline-processing behavior is repository-verifiable:

* `HF_HUB_OFFLINE=1`
* `TRANSFORMERS_OFFLINE=1`

are set by the runtime environment builder unless already present.

### Database And Storage Findings

Database bootstrap:

* first PostgreSQL initialization uses `db/init/001-bootstrap.sql`
  through Docker volume bootstrap behavior
* existing initialized databases rely on manual migration application
  from `db/migrations/`
* the repository does not yet provide one canonical migration-runner
  command

Storage assumptions:

* original binaries are still resolved from `data/imports/` through
  `file_binary.storage_package_id` +
  `file_binary.storage_rel_path`
* current runtime consumers use `BinaryStore` /
  `LocalBinaryStore` around that resolution
* processing artifacts live under `data/exports/processing/`
* processing runtime cache/temp state lives under
  `data/processing-runtime/`

### Proposal Assumptions Rejected Or Weakened

The proposal included several ideas that are valid goals but not current
instructions.

They were therefore kept out of `docs/SETUP.md` and moved to
`docs/TODO-setup-and-portability.md`:

* `setup.ps1`
* `doctor.ps1`
* processor readiness detection
* clean-Windows reproducibility claims
* one-command local startup such as `npm run start:local`
* existing-instance migration procedure
* storage portability/migration workflow
* canonical Windows install instructions for `pdftotext`, `pdfinfo`,
  and `qpdf`
* reproducible offline Docling/OCR model bootstrap

### Maintenance Policy Established

This checkpoint established the standing rule that:

> any change that adds, removes, upgrades, relocates, or materially
> changes a runtime prerequisite, external executable, service,
> environment variable, storage requirement, database bootstrap step,
> processor dependency, port, or startup procedure must update
> `docs/SETUP.md` in the same change.

### WIP_AGENTS Impact

After this checkpoint, the provisional setup-policy section in
`docs/discussions/WIP_AGENTS.md` can now be made repository-backed with
only small wording adjustments.

Specifically, it can now assert that:

* `docs/SETUP.md` is the operational setup source of truth
* `docs/TODO-setup-and-portability.md` is the source for unresolved
  setup/portability work

It should still avoid overstating clean-machine portability or setup
automation that does not yet exist.
