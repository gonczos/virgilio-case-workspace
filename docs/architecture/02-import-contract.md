# Import Contract

Last updated: 2026-08-30

## Purpose

This repository does not scrape live court systems.
It imports settled case corpus packages produced elsewhere.

The import contract must be:

- portable
- explicit
- append-safe
- provenance-preserving
- usable without the original scraper runtime

## Package Shape

Each imported package should represent one importable corpus snapshot.
A package can contain one case or a small connected case set.

Required top-level structure:

- `package.json`
- `cases/`
- `files/`
- `artifacts/`
- `provenance/`

## Required Files

### `package.json`

Must contain:

- `package_id`
- `created_at`
- `source_system`
- `package_kind`
- `case_count`
- `document_count`
- `file_binary_count`
- `producer`
- `schema_version`

### `cases/cases.jsonl`

One record per case.

Minimum fields:

- `source_system`
- `processo`
- `idprocesso`
- `tribunal_name`
- `unit_name`
- `idtribref`
- `idunorgref`
- `idcliente`
- `especie`
- `estado`
- `data_autuacao`
- `data_decisao`
- `parent_processo`
- `is_base_case`
- `case_scope_status`
- `canonical_confidence`

### `cases/buckets.jsonl`

One record per canonical bucket.

Minimum fields:

- `processo`
- `bucket_id`
- `reference_number`
- `bucket_date`
- `designation`
- `presenter`
- `modal_title`
- `document_count`
- `displayed_bucket_size_bytes`
- `canonical_confidence`

### `cases/documents.jsonl`

One record per canonical document.

Minimum fields:

- `document_key`
- `source_system`
- `document_procinfo`
- `document_name`
- `document_anchor_title`
- `document_date`
- `document_type`
- `document_type_from_attr`
- `claimed_size_bytes`
- `canonical_confidence`

### `cases/bucket_documents.jsonl`

One record per canonical bucket-document relation.

Minimum fields:

- `processo`
- `bucket_id`
- `document_key`
- `source_observation_count`
- `has_intra_bucket_duplication`
- `canonical_confidence`

### `cases/file_binaries.jsonl`

One record per binary.

Minimum fields:

- `sha256`
- `actual_size_bytes`
- `mime_type`
- `file_extension`
- `storage_rel_path`
- `retention_status`
- `integrity_check_status`
- `integrity_checker`
- `machine_readability_status`
- `page_count`
- `pages_with_text`
- `pages_without_text`
- `text_coverage_ratio`
- `total_extracted_characters`
- `page_text_report_json`
- `canonical_confidence`

### `cases/document_binaries.jsonl`

One record per canonical document-to-binary relation.

Minimum fields:

- `document_key`
- `sha256`
- `source_observation_count`
- `is_primary`
- `match_confidence`

## Files Directory

The `files/` tree should store the actual binaries.

Recommended storage path:

- `files/sha256/aa/<sha256>`

Optional convenience extension:

- `files/sha256/aa/<sha256>.pdf`

The DB should treat `sha256` as identity, not path.

## Artifacts And Provenance

`artifacts/` and `provenance/` are not required for basic consultation, but should be importable later.

Expected contents can include:

- scrape logs
- HTML snapshots
- manifests
- validation reports
- package build notes

## Import Behavior

V1 import should:

- register the package as an `import_batch`
- upsert canonical facts by alternate keys
- keep source-side keys visible
- preserve unresolved statuses
- never mutate binary hashes

V1 import should not:

- invent new source facts
- hide missing binaries
- collapse analyst enrichment into canonical source records

## Notes

The system should tolerate partial packages as long as `package.json` states what is missing.
