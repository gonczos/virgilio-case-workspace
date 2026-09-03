# Reference metadata inventory — 2026-09-03

## Scope

This is a read-only inventory of reference-bearing metadata already present in
PostgreSQL. It did not create reference observations, modify source records, or
change consultation behavior. Source-observation snapshot fields were treated
as lineage copies, not additional reference sources.

## Field inventory

| Source field | Origin / identifier type | Source records | Distinct normalized | Directly dated | Binary coverage | Pilot value overlap |
|---|---|---:|---:|---:|---:|---:|
| `case_file.processo` | Court / process number | 5 | 5 | 0 | Not directly linked | 0 |
| `case_file.idprocesso` | Court / source process ID | 5 | 5 | 0 | Not directly linked | 0 |
| `bucket.bucket_id` | Court / source occurrence ID | 897 | 897 | 897 | 897 linked | 19 |
| `bucket.reference_number` | Court / occurrence reference | 897 | 897 | 897 | 897 linked | 19 |
| `document.document_procinfo` | Court / source document reference | 1,293 | 1,293 | 1,293 | 1,257 linked; 36 missing | 17 |
| `case_workspace_reference.reference_value` | External register / workspace reference | 0 | 0 | 0 | Not assessed | 0 |

All populated required fields satisfy their database non-blank contract.
Nullable source identifiers have no documented identifier grammar, so their
2,195 populated values are reported as `valid_unclassified_format`, not as
format-validated or malformed.

## Normalization and overlap

Normalization uses NFKC, surrounding-whitespace removal, internal-whitespace
collapse, and uppercase conversion while retaining every raw value.

- Fifteen source document references change under normalization.
- No distinct raw values collapse to the same normalized value, either within
  a field or across the inventoried fields.
- There are 1,135 contextual overlap groups. These are not normalization
  collisions: 897 are the same value appearing in both `bucket_id` and
  `reference_number`, and 238 are source document references associated with
  more than one process context.
- Detailed groups retain each raw value together with its source field,
  identifier type, source record, process context, directly anchored date, and
  binary state. The detector also includes reuse across separate source records
  within one field and proceeding; the current corpus contains no additional
  groups of that form.
- The current pilot contains 57 observations over 47 normalized values.
  Metadata source-record overlaps are reported per field in the table above;
  the same value can overlap more than one field and is not a resolved identity.

## Provenance and missing binaries

Every populated inventoried court-metadata row can be traced to its source
record and process context without inference. Occurrence fields carry their own
`bucket_date`. Source document references inherit only their explicit
bucket-document occurrence links; reused documents retain all contexts rather
than borrowing one date as universal.

Thirty-six document source records have no linked binary, producing 39
occurrence-context rows. They remain inventory candidates through their source
document reference and occurrence context. This includes the class of court
records where the online system did not supply the underlying file.

The external-register table currently contains no rows. External-register
observations in the pilot therefore do not yet have a corpus-wide persisted
source in `case_workspace_reference`; corpus-wide external coverage cannot be
claimed from the present database.

## Feasibility conclusion

Corpus-wide ingestion of court-system metadata references is feasible without
reprocessing binaries. The source record, identifier type, process context,
direct occurrence date where applicable, and missing-binary state are all
available. Field-specific ingestion rules are still required: `bucket_id` and
`reference_number` are currently duplicate-valued dimensions, while process,
occurrence, and document identifiers must remain distinct namespaces.

This inventory does not justify corpus-wide document-text reference extraction,
external-register coverage, identifier resolution, or a combined ranking.

## Validation

- `node --test test/reference-metadata-inventory.test.mjs test/reference-search-store.test.mjs`
- Live execution through `buildReferenceMetadataInventory(...)` against the
  current PostgreSQL database
- `git diff --check`

The reusable command is `npm run reference:inventory`. It prints concise
structured JSON and performs no database writes. Append
`-- --include-overlap-details` to include every context-sensitive overlap group.
