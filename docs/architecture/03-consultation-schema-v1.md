# Consultation Schema V1

Last updated: 2026-08-30

## Goal

V1 supports consultation first, enrichment second.

That means the schema must make it easy to:

- browse cases
- follow bucket chronology
- inspect document occurrences
- inspect binary coverage
- expose text accessibility
- record analyst notes without altering source fact

## Layers

### Import layer

Tracks which package was loaded.

Tables:

- `import_batch`

### Canonical source-fact layer

Stores settled factual records.

Tables:

- `country`
- `court`
- `case_file`
- `bucket`
- `document`
- `bucket_document`
- `file_binary`
- `document_binary`

### Consultation layer

Stores operator-facing annotations that are not source fact.

Tables:

- `consultation_note`
- `document_issue`

## Naming Choices

- singular table names
- `id` as PK everywhere
- FK columns use `<table>_id`
- `case_file` is used instead of reserved word `case`

## Canonical Identity

Expected alternate keys:

- `country.id` is ISO alpha-2
- `court`: source-side court identifier tuple
- `case_file`: `source_system + processo`
- `bucket`: `case_file_id + bucket_id`
- `document`: `source_system + document_procinfo + document_name + document_date + document_type + claimed_size_bytes`
- `bucket_document`: `bucket_id + document_id`
- `file_binary`: `sha256`
- `document_binary`: `document_id + file_binary_id`

## Consultation Requirements

The consultation UI should be able to answer:

- which cases exist
- which buckets belong to a case
- which documents appear in a bucket
- whether a document has a binary
- whether a binary is text-readable
- which items are unresolved or manually flagged

## Deferred

Not yet included:

- OCR text tables
- extracted full text passage tables
- semantic entities
- event graphs
- AI outputs
- review workflow state machine
