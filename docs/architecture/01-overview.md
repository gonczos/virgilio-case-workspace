# Architecture Notes

Last updated: 2026-08-30

## Working Assumptions

- scraping is currently treated as settled enough for downstream consultation work
- source acquisition remains in the separate `virgilio-court-docs` repository
- this repository consumes exported corpus data, not live tribunal pages
- source fact, derived text, and enrichment must remain clearly separated

## Initial Recommendation

Use prebuilt Docker images first:

- `postgres` for the durable relational store
- `directus/directus` for an initial consultation UI and generated API
- optional `dpage/pgadmin4` only for maintenance if needed

## Why This Shape

- low setup burden for handoff
- portable on another machine with Docker Desktop
- avoids coupling the product to the local SQL Server analysis environment
- supports later migration from read-only consultation to reviewed enrichment

## Domain Layers

1. Source provenance
- imported packages
- scrape logs
- manifests
- evidence artifacts

2. Canonical corpus
- country
- court
- case
- bucket
- document
- bucket_document
- file_binary
- document_binary

3. Consultation layer
- operator-friendly views
- timelines
- dossier summaries
- unresolved issue surfacing

4. Enrichment layer
- notes
- extracted entities
- chronology hypotheses
- review states
- AI-assisted outputs with provenance

## Key Principle

The first user-facing product is not the scraper. It is a trustworthy case consultation workspace.
