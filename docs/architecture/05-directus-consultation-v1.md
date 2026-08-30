# Directus Consultation V1

Last updated: 2026-08-30

## Goal

The first consultation UI should be read-first.

It should let a non-technical user:

- open a case and see its scope quickly
- move through bucket chronology
- see which documents are attached to each bucket
- identify unresolved documents and missing binaries
- inspect binary quality signals before attempting OCR or review

## Why Views

The canonical tables are intentionally normalized.

That is good for provenance and import correctness, but clumsy for consultation.
The initial Directus setup should therefore expose a small set of read-oriented SQL views on top of the canonical tables.

## Views

### `casework.v_case_summary`

One row per case.

Useful fields:

- `processo`
- `parent_processo`
- `bucket_count`
- `unique_document_count`
- `documents_with_binary_count`
- `documents_without_binary_count`
- `first_bucket_date`
- `last_bucket_date`

### `casework.v_bucket_summary`

One row per bucket.

Useful fields:

- `processo`
- `bucket_id`
- `bucket_date`
- `designation`
- `presenter`
- `document_count`
- `unique_document_count`
- `documents_without_binary_count`

Recommended default sort:

- `processo` ascending
- `bucket_date` ascending
- `bucket_id` ascending

### `casework.v_document_summary`

One row per canonical document.

Useful fields:

- `document_procinfo`
- `document_name`
- `document_date`
- `document_type`
- `claimed_size_bytes`
- `bucket_link_count`
- `binary_link_count`
- `primary_sha256`
- `primary_mime_type`
- `primary_machine_readability_status`
- `primary_storage_rel_path`

### `casework.v_unresolved_document`

Only bucket-document rows where no binary is linked.

This is the main manual follow-up queue.

Useful fields:

- `processo`
- `bucket_id`
- `bucket_date`
- `designation`
- `document_procinfo`
- `document_name`
- `document_type`
- `claimed_size_bytes`

## Directus Collections To Expose First

Recommended first-wave collections:

- `casework.v_case_summary`
- `casework.v_bucket_summary`
- `casework.v_document_summary`
- `casework.v_unresolved_document`
- `casework.consultation_note`
- `casework.document_issue`

## Suggested Directus Presets

### Cases

- primary key display: `processo`
- visible columns: `processo`, `parent_processo`, `bucket_count`, `unique_document_count`, `documents_with_binary_count`, `documents_without_binary_count`

### Buckets

- filter by selected `processo`
- visible columns: `bucket_date`, `bucket_id`, `designation`, `presenter`, `document_count`, `documents_without_binary_count`

### Documents

- filter by `document_procinfo`, `document_name`, `document_date`
- visible columns: `document_name`, `document_date`, `document_type`, `claimed_size_bytes`, `primary_machine_readability_status`, `primary_storage_rel_path`

### Unresolved

- sort by `processo`, `bucket_date`, `bucket_id`
- visible columns: `processo`, `bucket_date`, `bucket_id`, `designation`, `document_name`, `document_type`, `claimed_size_bytes`

## File Access

At this stage, `primary_storage_rel_path` points to the package-side file location inside the workspace import tree.

That means:

- the metadata is consultation-ready now
- direct browser download links are not yet productized
- the next small step is a controlled file-serving layer or storage import strategy

## Next Step

After the views are exposed in Directus, the next engineering step should be one of:

1. add a lightweight binary-serving endpoint keyed by `sha256`
2. or import the settled binaries into a dedicated app-side storage layout and expose stable links
