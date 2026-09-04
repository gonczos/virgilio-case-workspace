# Adapting Citius observations to the workspace model

Verified: 2026-09-05. This document explains **how source data relates to our
system**, separately from the [source/storage dictionary](17-citius-source-data-dictionary.md).
Existing behavior and future proposals are distinguished. No correction or
migration is implemented by this document.

## Two ingestion paths and their authority

1. `app/import-package.mjs` imports the upstream portable package into normalized
   court, case, bucket, document and binary tables, with package provenance.
2. `app/citius-html-snapshot.py` and `app/citius-html-import.mjs` preserve saved
   HTML in provenance, link unique current records and compare fields. They do
   **not** write normalized court records or run the package upsert functions.

Thus “captured” does not mean “populated in the normalized column,” and a report
mapping is not a completed correction. Capture 1 is the earlier portable-package
provenance; capture 2 is the saved-HTML registration. Different captures remain
independent evidence, even when they describe the same records.

## Identity and relationships

| Our table | Source-to-system meaning | Identity / boundary |
| --- | --- | --- |
| `country` | Package jurisdiction, e.g. PT | Not extracted from these HTML rows |
| `court` | Court and organizational unit | Source system + `idtribref`, `idunorgref`, `idcliente` tuple |
| `case_file` | Official proceeding | Source system + case number; source case ID separately unique |
| `bucket` | Procedural occurrence/group | Internal case FK + source `bucket_id` |
| `document` | Source-keyed logical document | Imported composite key includes source, procinfo, name, date, type, claimed size |
| `bucket_document` | Document in a particular bucket | Unique internal bucket/document pair |
| `file_binary` | Exact acquired file bytes | Full SHA-256, measured size, storage identity |
| `document_binary` | Established backing of a document | Document/binary association; not supplied by these HTML rows |
| `case_workspace` and its links | Our organizational workspace | Not a court HTML entity |

The HTML reconciler requires case number **and** `idprocesso`, then bucket source
ID within that case, then `procinfo` within that bucket. It links only a unique
match. It does not assume `procinfo` alone is the database's document alternate
key. All 2,070 occurrence keys matched in this capture; other inputs may be
ambiguous and must remain unlinked. Internal numeric PKs are not source IDs.

Source order is not identity. A repeated row remains a separate observation, while
the normalized occurrence pair remains one relation. Full document tables are
preserved but not counted again by the reconciler. Counts/duplicate flags in
`bucket_document` originate in the portable package; this importer does not
recompute or validate those flags from raw row counts.

## Mapping by normalized destination table

### `casework.court`

| HTML case attribute | Destination | Current HTML audit behavior |
| --- | --- | --- |
| `data-idtribref` | `idtribref` | Preserved; not field-compared by this mapper |
| `data-idunorgref` | `idunorgref` | Preserved; not field-compared |
| `data-idcliente` | `idcliente` | Preserved; not field-compared |
| `data-tribunal` | `tribunal_name` | Preserved; not field-compared |
| `data-unorganica` | `unit_name` | Preserved; not field-compared |

These destination fields exist and were populated through the package. Their
presence in `unmodeled_attributes` means “unused by this comparator,” not “absent
from our system.” A future court-field comparison should follow `case_file.court_id`.

### `casework.case_file`

| HTML attribute | Destination | Capture 2 comparison |
| --- | --- | --- |
| `data-processo` | `processo` | Equal in all five cases |
| `data-idprocesso` | `idprocesso` | Equal in all five |
| `data-especie` | `especie` | Equal in all five |
| `data-estadoprocesso` | `estado` | Equal in all five |
| `data-dataautuacao` | `data_autuacao` | Equal in all five |
| `data-datadecisao` | `data_decisao` | Equal after absence handling |

`court_id`, workspace membership, parent-case FK, base-case flag, scope and
canonical confidence are not extracted by this HTML mapper. No case-parent
relationship is inferred from suffixes in the displayed process number.

### `casework.bucket`

| HTML location | Destination | Capture 2 comparison |
| --- | --- | --- |
| `data-proc` | `bucket_id` | 897 equal |
| Cell 0 | `bucket_date` | 897 equal |
| Cell 1 | `designation` | 890 equal, seven internal-whitespace differences |
| Cell 2 | `presenter` | 893 equal, four internal-whitespace differences |
| Cell 3 | `reference_number` | 897 equal |
| Cell 4 | `displayed_bucket_size_bytes` | Missing in all 897 normalized records |

`case_file_id` comes from matching the enclosing case. `modal_title` and
`document_count` remain package fields; the current comparator does not assess
them. Bucket reference and source ID are separate fields even where values agree.

### `casework.document`

| HTML location | Destination | Capture 2 comparison |
| --- | --- | --- |
| `data-procinfo` | `document_procinfo` | 2,074 observations equal |
| Cell 0 | `document_date` | All equal |
| Cell 1 | `document_name` | 2,067 equal, seven whitespace differences |
| Cell 2 | `document_type` | All equal |
| Cell 3 | `claimed_size_bytes` | All equal, including zero |
| `data-tipoconteudo` | `document_type_from_attr` | Missing for all 1,293 distinct documents |
| Download-link `title` | `document_anchor_title` | Missing for all 1,293 distinct documents |

The displayed name, download title, content-type code and intrinsic content
classification are different concepts. A title such as `Comprovativo
[Comprovativo]` is not automatically an attachment label or semantic category.
Do not replace `document_name` with the richer title. Name is also part of the
imported document identity key, so even cosmetic changes need identity analysis.

### Fields without an agreed normalized mapping

| HTML case attributes | Current storage | Decision needed |
| --- | --- | --- |
| `data-intervnome1/2`, `data-intervdesig1/2` | Raw provenance | Participant/role observations, identity resolution and case-specific roles; do not merge people by name |
| `data-idestadoprocesso` | Raw provenance | Retain alongside label or introduce reviewed source-code vocabulary |
| `data-datatransitointerv`, `data-datatransitoproc` | Raw provenance, all literal `null` | Verify meaning and availability before adding legal-date fields |
| `data-isarquivado`, `data-isfindo`, `data-isosae`, `data-isparte`, `data-showpecas` | Raw provenance, all `undefined` | Determine whether meaningful data or UI state; do not coerce to false |
| CSS/style/anchor action attributes and duplicate display cells | Raw provenance | No domain promotion proposed |

No normalized participant model is introduced here. Additional fields may already
exist in other historical payloads; raw preservation is not proof of prior absence.

## Transformations and loss boundaries

| Layer | Current behavior | Consequence |
| --- | --- | --- |
| Original HTML | Stored as base64 + hash | Exact bytes remain recoverable |
| Parsed HTML | UTF-8 with optional BOM; entities decoded; row attribute dictionaries; text concatenated and outer-trimmed | Layout/markup is not reconstructed from cells; use raw bytes |
| Size comparison | Removes `.` separators from text | `5.197.876` compares with `5197876`; no measured-size claim |
| General comparison | Null, missing, literal `null` and `undefined` become empty; other values stringified/trimmed | Raw markers retained separately; internal whitespace still differs |
| Date comparison | SQL dates selected as text | Avoids timezone conversion of calendar dates |
| Older package importer | Trims text, maps empty text to SQL null, parses numeric package values, passes calendar-date strings | It does not itself collapse internal whitespace; the earlier normalization's exact upstream location was not established |

The report's `equal` means equal under these specific transformations.
`omitted_in_current` means nonempty observed value against an empty normalized
field. `source_empty_current_populated` and `different` require review, not
automatic overwrites. The 18 differences in this capture were checked and all
reduce to internal whitespace. There are no substantive populated-field
differences among the fields actually compared.

## Proposed correction process (not implemented)

The first bounded proposal is to populate existing columns:
`bucket.displayed_bucket_size_bytes`, `document.document_anchor_title` and
`document.document_type_from_attr`. No new domain table is needed for these.

Before execution: group observations by target, retain all source paths/hashes,
require agreement or expose conflicts, review expected before/after values,
and retain an attributed correction decision. Updates should check their expected
old values transactionally. Never silently replace a populated differing value.
The present raw importer supplies evidence; it is not the correction writer.

**Re-import hazard:** `app/import-package.mjs` upserts bucket size and document
title/type-attribute fields directly from incoming package values, including
nulls. A later import of the original incomplete package can therefore overwrite
future corrections. Resolve precedence and replay behavior before promoting
values: either improve the upstream export with lineage or define a reviewed
overlay/protected correction policy. Neither policy is implemented here.

## Binary, attachment and consultation boundaries

HTML procinfo IDs are not file hashes. Claimed sizes and names do not establish
`document_binary` links. Acquired binaries and their hashes come from separate
download/package evidence. Failed-download HTML hashes identify the response,
not the missing image. File registration continues through existing storage and
provenance mechanisms; raw HTML is not registered as a court document binary.

The [candidate/attachment design](15-document-binary-candidates-and-attachments.md)
remains unimplemented. It separates possible binary backing from document-level
attachment membership. Attachment numbering comes from separate evidence, not
unstable table order. Those concepts must not be inferred merely by importing
these fields. The April 2021 three-image ambiguity is unchanged.

Existing court-record APIs retain their source-recorded semantics. Raw capture
fields and future corrections do not automatically appear in all consultation,
search, graph or export interfaces. Any exposure must distinguish raw labels,
accepted normalized values and interpretations; preserve lineage and avoid local
filesystem paths. No OCR or search reindexing is needed to document this mapping.

## Remaining work and references

1. Review the three existing-field correction sets and choose re-import precedence.
2. Extend comparisons to court fields, modal/count metadata and source conflicts
   only where their extraction is specified; do not claim the current report does so.
3. Decide whether participant/role and other preserved fields merit domain models.

Implementation references: [HTML loader](../../app/citius-html-import.mjs),
[snapshot parser](../../app/citius-html-snapshot.py),
[package importer](../../app/import-package.mjs),
[schema](../../db/init/001-bootstrap.sql),
[provenance contract](16-saved-citius-html-provenance.md), and
[coverage report](../discussions/2026-09-05-citius-html-coverage.md).
