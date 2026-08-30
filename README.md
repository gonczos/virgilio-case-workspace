# Virgilio Case Workspace

Last updated: 2026-08-30

This repository is the consultation and enrichment workspace for a sensitive court-case corpus.
It is intentionally separate from the scraping project.

## Purpose

This system is meant to:

- load settled case corpus data produced by the scraper project
- expose the corpus for human consultation first
- preserve provenance and unresolved issues clearly
- support later enrichment without confusing derived content with source fact

## Initial Product Shape

Phase 1 for this repository is a local Dockerized consultation system.

Core capabilities:

- browse cases
- inspect case metadata
- inspect bucket timeline
- inspect documents linked to each bucket
- open binary files and text derivatives
- view provenance, confidence, and unresolved items

## Deployment Direction

The first target deployment is `docker compose`.

Planned services:

- `postgres`: durable application database
- `directus`: initial read-first consultation UI and API
- optional later services:
  - OCR/text extraction worker
  - search index
  - custom domain API

## Repository Layout

- `docs/architecture/`: target architecture and decisions
- `db/init/`: database bootstrap SQL
- `db/migrations/`: incremental SQL for already initialized databases
- `app/`: app-layer config and later custom code
- `data/imports/`: imported case packages
- `data/storage/`: mounted file corpus storage
- `data/exports/`: app-side exports or derived packages

## Importer

After the Docker services are up and `pg` is installed locally for the importer:

```bash
npm install
npm run import:package -- data/imports/<package-dir>
```

## Consultation Views

The initial consultation layer is exposed through these read-oriented SQL views:

- `casework.v_case_summary`
- `casework.v_bucket_summary`
- `casework.v_document_summary`
- `casework.v_unresolved_document`

For an already initialized database, apply the current view migration with:

```bash
docker exec -i virgilio-case-db psql -U virgilio -d virgilio_case_workspace < db/migrations/2026-08-30-001-consultation-views.sql
```

See `docs/architecture/05-directus-consultation-v1.md` for the first Directus-facing consultation shape.
See `docs/architecture/06-import-pipeline.md` for the end-to-end import and consultation flow.
See `docs/architecture/07-consolidated-architecture-reference.md` for the current consolidated architecture reference.

## Binary Access

The stack now includes a small file gateway for settled binaries:

- `GET http://localhost:8090/health`
- `GET http://localhost:8090/binary/<sha256>`

For the current imported package, binaries are resolved from:

- `data/imports/<package_id>/files/sha256/...`

## Next Steps

1. export one settled case package from the scraper repository
2. import it into this repository
3. inspect the imported corpus through Directus
4. decide whether Directus is sufficient for the first consultation workflow
5. add dossier-oriented views and issue surfacing
