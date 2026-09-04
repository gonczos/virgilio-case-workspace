# Saved Citius HTML provenance

Field documentation is split into the [source data and storage dictionary](17-citius-source-data-dictionary.md)
and [adaptation to the workspace model](18-citius-system-adaptation.md). This page
describes the operational capture contract.

Status: implemented 2026-09-05. This is an offline source-observation import,
not a new scraper or a canonical-record correction operation.

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
representation or existing provenance rows. It uses the configured DB credential,
not the read-only `ptdocs_reviewer` role, because provenance insertion is required.
No grants or roles are changed. This is an application-scoped write boundary, not
a new database-enforced restricted credential.

The capture uses `manual_source_capture`: its timestamp is the local registration
time. The producer run label is preserved, but no verified per-row observation
timestamp or scraper version is invented. Extractor/loader and snapshot hashes
identify the processing lineage. The capture key is based on the source manifest;
identical reruns reuse it, verify stored raw bytes and link counts, and append no
duplicates. Changed parsing with the same source identity is rejected for an
explicit future versioning decision rather than overwriting observations.

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
