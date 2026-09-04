# Court-record consultation read model

## Purpose and boundary

The court-record consultation read model gives an AI or human client a compact,
queryable orientation layer over metadata imported from the court system. It is
read-only. It does not classify document contents, resolve references, infer
legal relationships, alter provenance, or expose local filesystem paths.

The result unit is one source document associated with one procedural
occurrence (`bucket_document`). This occurrence-centred grain is deliberate:
the same source document or binary may appear in several procedural contexts,
and those contexts must not be collapsed.

## Interfaces

The shared implementation is exposed as:

- `GET /api/consultation/court-records` in the consultation API;
- `query_court_records` in the disposable v1 consultation MCP.

Both interfaces accept the same filters. Internal IDs are exact filters:
`court_id`, `case_file_id`, `bucket_id`, `bucket_document_id`, `document_id`,
and `file_binary_id`. Source-recorded filters are `process_number`,
`occurrence_reference`, `source_bucket_id`, and
`source_document_reference`. Additional filters are `document_name_contains`,
`document_type`, `date_from`, `date_to`, `binary_sha256`, and
`file_availability`. Pagination uses observation rows with `limit` (maximum
100) and `offset`.

`document_name_contains` is a case-insensitive substring query. Other text
filters are exact. Dates are inclusive source calendar dates in `YYYY-MM-DD`
form. They filter the source-recorded procedural occurrence date; they are not
claims about when the document was authored, signed, served, or became legally
effective.

## Response shape

Each result keeps these layers separate:

1. `court`: normalized internal identity plus the court system's identifiers,
   tribunal, and unit.
2. `case`: internal case identity, process number, source case identifier,
   source classification/status, source calendar dates, and parent/base-case
   structure.
3. `occurrence`: the court-system bucket identity, reference, recorded date,
   designation, presenter, and source labels.
4. `document`: the source-document identity, exact source reference/name/type,
   recorded document date, and occurrence-link observations.
5. `binaries`: zero or more associated binaries, deduplicated by their stored
   associations and identified by full SHA-256. The MCP points clients to
   `get_binary_details`; it does not return a download URL.
6. `relationships`: source-recorded structural edges only (`has_occurrence`,
   `contains`, and `represented_by`). They are explicitly not resolved legal or
   semantic relationships.

The source system's document name, occurrence designation, and type fields are
preserved as labels, not asserted as reliable content classifications. A result
with no binary has `file_state.status = missing`, an empty `binaries` array, and
no invented binary identity. Missing binary, missing source record, and failed
text extraction remain different conditions.

## Pagination and coverage

Results sort by recorded occurrence date ascending (null last), process number,
internal bucket ID, and occurrence-document link ID. `total_matching` is a
number when the returned page contains a row, and zero for an empty first page.
It is `null` when a non-zero offset is beyond the final row because the windowed
count is no longer observable from that page. Clients must not reinterpret
`null` as zero.

Coverage is limited to imported court-system metadata. A no-match response does
not prove that a document, occurrence, or fact is absent from the original court
file. Likewise, source-recorded relationships have not been independently
verified against original PDFs.

## Deliberate exclusions

This checkpoint does not add recorded-reference lookup, citation resolution,
document taxonomy enrichment, contents inventories, graph traversal, binary
delivery, review/editing operations, ingestion, or database schema changes.
