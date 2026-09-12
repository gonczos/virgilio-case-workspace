# Architecture Notes

Accepted future planning foundation: [Virgilio Consultation 2.0.0 beta semantic baseline](24-virgilio-2-semantic-planning-baseline.md)
(planning only; complete contracts and development are not authorized).

Consultation v1 inventory and public contract boundary:
[Consultation v1 contract and runtime baseline](22-consultation-v1-contract-and-runtime-baseline.md)
(documented, not implemented).

Agreed final-phase target: [Consultation v1 read-only online service package](21-consultation-v1-read-only-online-service-package.md)
(documented, not implemented).

Agreed future design: [entity-specific external identifier collections](20-entity-specific-external-identifiers.md)
(documented, not implemented).

For saved Citius metadata, see the [source/storage field dictionary](17-citius-source-data-dictionary.md)
and the separate [system adaptation mapping](18-citius-system-adaptation.md).

Last updated: 2026-09-08

For the bounded reference-observation and text-search foundation, see
`10-reference-observations-and-search-pilot.md`.

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
