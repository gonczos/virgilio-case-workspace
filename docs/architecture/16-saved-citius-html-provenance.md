# Saved Citius HTML provenance

Field documentation is split into the [source data and storage dictionary](17-citius-source-data-dictionary.md)
and [adaptation to the workspace model](18-citius-system-adaptation.md). This page
describes the operational capture contract.

Status: implemented 2026-09-05. This is an offline source-observation import,
not a new scraper or a canonical-record correction operation.

## Payload interpretation identity

The capture's existing `metadata_json.adapter` is
`{"key":"citius-saved-html","version":"1"}`. This identifies the saved payload
contract documented in the source dictionary, not the original scraper or an
executable loaded from metadata. No adapter registry or dynamic dispatch is added.
Version 1 describes `case_row`, `bucket_row`, `document_row` and full-table
`artifact` payloads with raw bytes, hash/path, context, rows and elements. The
`coverage-report` observation is derived output, explicitly excluded from HTML
payload validation and not an original source artifact.

`app/citius-html-payload.mjs` checks this known identity and minimum shape; the
existing importer separately verifies byte hashes. Unknown adapter identities
are rejected, not overwritten. Existing capture 2 was labelled after verification
on reuse; only the capture metadata gained the descriptor. Raw observations,
processor hashes and earlier reports remain unchanged. New captures receive it
at creation. Other sources/captures are not assigned the Citius descriptor.

An incompatible change to payload interpretation requires a new version and an
explicit migration/reprocessing decision. Importer code hashes continue identifying
exact executions independently of this stable format version. Interpretations or
enrichment must not be silently inserted into the original source payload; retain
separate attributed observations/findings. Existing searches and displays continue
using their current fields; the descriptor does not make raw metadata searchable.

The existing `casework.source_capture`, `source_observation` and
`source_observation_link` tables accommodate saved HTML without a migration.
`app/citius-html-snapshot.py` snapshots all HTML in a specified extracted audit
directory. Archives and non-HTML artifacts are outside this operation. It stores
original bytes as base64, SHA-256, relative path, parsed element attributes, row
cells/links and case/bucket context. Raw bytes preserve details beyond the parser's
current interpretation. HTML and links are never executed. Sources are read-only;
the output must be a new path outside the source directory.

`app/citius-html-import.mjs` verifies snapshot byte hashes, reads current court
records and appends a capture, observations, exact-key links and a coverage report
in one transaction. It issues no changes to case, bucket, document, binary,
representation or existing observation/link rows. On reuse it can label a verified
legacy capture missing adapter metadata. It uses the configured DB credential,
not the read-only `ptdocs_reviewer` role, because provenance insertion is required.
No grants or roles are changed. This is an application-scoped write boundary, not
a new database-enforced restricted credential.

The capture uses `manual_source_capture`: `captured_at` now describes source run
start, with `capture_time_basis` distinguishing inferred, reported, unknown and
legacy-unspecified times. `capture_ended_at` remains null when unknown. The run-label
timestamp is inferred, not verified per-row observation time. No scraper version
is invented. Extractor/loader and snapshot hashes
identify the processing lineage. The capture key is based on the source manifest;
identical reruns reuse it, verify stored raw bytes and link counts, and append no
duplicates. Changed parsing with the same source identity is rejected for an
explicit future versioning decision rather than overwriting observations.

Each database import attempt now has a `casework.import_execution` header with
start/end time, status, importer/input hashes, counts and optional failure details.
Retries create new execution headers while reusing the source capture. The prior
HTML registration timestamp was preserved in a `historical_completed` header and
capture metadata; its exact execution end is unknown. See the
[import execution contract](19-import-execution-and-source-time.md).

Case and bucket rows use their existing observation kinds. Individual document
HTML rows and complete document tables use `package_artifact`, with an explicit
payload kind: they are not falsely labelled deduplicated occurrence groups.
Repeated rows remain separate by relative source path. Complete document tables
are preserved but not counted a second time as court occurrences.

Mapping requires an unambiguous process number plus case source ID, then bucket
source ID, then document `procinfo` within that bucket. Only a unique target gets
a source-observation link. Row order is not an identity key. Document links target
`document_id` as the current link schema permits; payload context retains the
bucket, and coverage counts retain occurrence IDs. Missing/ambiguous matches are
reported without creating canonical records.

Comparison covers case identity/classification/status/calendar dates, bucket
identity/date/designation/presenter/reference/displayed size, and document
identity/date/name/type/HTML type attribute/claimed size/download title. SQL dates
are cast to text to avoid timezone shifts. Comparison normalization trims text,
treats null/undefined source markers as absent and removes size thousands
separators; original values remain in the raw capture. Additional attributes are
inventoried as not mapped by this comparator, not declared absent everywhere.
There is no automatic entity extraction from participant fields or interpretation
of interface flags. Conflicts and omissions require separate review and promotion.

The derived report is stored as another `package_artifact` in the same capture;
local snapshots/reports are git-ignored and should be backed up. Consultation and
export APIs have not been extended to display this capture. Existing portable
exports must not be assumed to include every new raw artifact automatically.

See [results](../discussions/2026-09-05-citius-html-coverage.md) and
[setup](../SETUP.md) for the completed capture and commands.
