# Citius saved source data and storage dictionary

Verified: 2026-09-05 against the saved multicase HTML, the snapshot/import code and
the PostgreSQL schema. This document describes **what we captured and where it is
stored**. [Adaptation to our system](18-citius-system-adaptation.md) separately
describes identity, normalization, mapping and proposed corrections.

“Citius” here is the user's name for the court material obtained through
`processos.tribunais.org.pt`; our source-system key is `tribunais_org_pt`. Field
meanings below describe observed interface roles, not an official court API
specification. Unverified meanings are marked explicitly. No live-site search is
needed to describe these saved artifacts.

## Source scope and logical tables

These are HTML interface tables, not access to the court's internal database.
The snapshot root is the extracted multicase audit directory. Archives, the
Google Drive export, PDF binaries and direct-download result logs are separate
source artifacts and are not inputs to this HTML importer.

| Source file | Logical row/table | Saved files | Stored observation kind |
| --- | --- | ---: | --- |
| `<case>/case-row.html` | One displayed case | 5 | `case_row` |
| `<case>/entry-*/bucket-row.html` | One procedural bucket | 897 | `bucket_row` |
| `<case>/entry-*/document-row-*.html` | One displayed document occurrence | 2,074 | `package_artifact`, payload kind `document_row` |
| `<case>/entry-*/document-table.html` | Complete displayed document table | 897 | `package_artifact`, payload kind `artifact` |

There are 2,070 distinct document occurrences and 1,293 distinct `procinfo`
values. Repeated rows and the full table copies are preserved, not counted as
additional logical documents. `entry-*` and row numbers identify saved positions;
the user reports unstable rendering order, so they are not court identities.

All source attributes and cell values are strings. Examples below are literal
source forms; they are not PostgreSQL types. JSON array indexes are **zero-based**.
For individual row files, `rows[0]` denotes their only row.

## Case table: `case-row.html`

Each attribute below is stored under
`source_observation.payload_json.rows[0].attributes[attribute]`. It also appears
in the element attribute inventory and original bytes.

| HTML attribute | Observed role / example | Qualification |
| --- | --- | --- |
| `data-processo` | Display case number, e.g. `13608/14.8T2SNT` | Distinct from numeric source case ID |
| `data-idprocesso` | Source case ID, e.g. `3354063` | Opaque identifier |
| `data-especie` | Case classification label | Source label, not our inferred taxonomy |
| `data-estadoprocesso` | Status label: `Processo Pendente`, `Processo com Decisão` | Source snapshot status |
| `data-idestadoprocesso` | Associated status code: `4`, `3` | Complete code vocabulary unknown |
| `data-dataautuacao` | Source registration date, e.g. `2017-01-01` | Calendar date; no time or timezone supplied |
| `data-datadecisao` | Source decision date or literal `null` | Does not identify which decision or establish legal effect |
| `data-datatransitointerv` | Date-like transition field; all captured values `null` | Precise legal meaning unverified |
| `data-datatransitoproc` | Date-like case transition field; all values `null` | Precise legal meaning unverified |
| `data-idcliente` | Court-interface client identifier, `4` | Not interpreted as a person/client entity |
| `data-idtribref` | Court reference identifier, `2677103` | Opaque source identifier |
| `data-idunorgref` | Organizational-unit reference, `3994056` | Opaque source identifier |
| `data-tribunal` | Displayed court name | E.g. Tribunal Judicial da Comarca de Lisboa Oeste |
| `data-unorganica` | Displayed unit name | E.g. Sintra - Juízo Fam. Menores - Juiz 6 |
| `data-intervnome1` | First displayed participant name | Spelling/accent variants retained; not a stable person key |
| `data-intervdesig1` | First displayed participant role | E.g. `Requerente`, `Recorrido` |
| `data-intervnome2` | Second displayed participant name | No assumption that two slots exhaust all participants |
| `data-intervdesig2` | Second displayed participant role | E.g. `Requerido`, `Recorrente` |
| `data-isarquivado` | Interface flag, captured as `undefined` | Not interpreted as false |
| `data-isfindo` | Interface flag, captured as `undefined` | Not interpreted as false |
| `data-isosae` | Interface flag, captured as `undefined` | Business meaning unverified |
| `data-isparte` | Interface flag, captured as `undefined` | Business meaning unverified |
| `data-showpecas` | Interface/display flag, captured as `undefined` | Does not establish document availability |

The case row has nine cells, stored as `rows[0].cells[i]`:

| Index | Display content |
| ---: | --- |
| 0 | Registration date |
| 1 | Case number |
| 2 | Classification |
| 3 | Participant names and roles, nested markup and participant-expansion action |
| 4 | Court name and unit-expansion action |
| 5 | Hidden court-name cell (`listrib`) |
| 6 | Hidden unit-name cell (`listUO`) |
| 7 | Status label |
| 8 | Consult/select process action, including `Consultar Processo` link title |

The comparator uses case attributes, not these duplicate display cells. The cell
parser concatenates nested text and trims outer whitespace; it does not insert
line separators for `<br>`. Use original bytes to reconstruct display structure.

## Bucket table: `bucket-row.html`

| Source location | Observed role / example | Raw payload location |
| --- | --- | --- |
| `tr[data-proc]` | Bucket source identifier, e.g. `18667032` | `rows[0].attributes["data-proc"]` |
| Cell 0 | Source occurrence date, `2021-04-23` | `rows[0].cells[0]` |
| Cell 1 | Designation, e.g. `Requerimento` | `rows[0].cells[1]` |
| Cell 2 | Presenter label, e.g. `Dina Vasa` | `rows[0].cells[2]` |
| Cell 3 | Displayed reference, e.g. `18667032` | `rows[0].cells[3]` |
| Cell 4 | Displayed size, e.g. `5.197.876` | `rows[0].cells[4]` |

The size is treated as reported bytes by the existing comparison, with dots as
thousands separators. It is not a measured sum of downloaded files. The example
bucket total equals six listed PDFs while its three image rows report zero.
The `showActDocuments` anchor is a UI action, not a preserved binary URL.
No modal-title or document-count field is extracted from these five cells.

## Document table: `document-row-*.html` and `document-table.html`

| Source location | Observed role / example | Raw payload location |
| --- | --- | --- |
| `tr[data-procinfo]` | Court document key; UUID or composite numeric/UUID string | `rows[i].attributes["data-procinfo"]` |
| `tr[data-tipoconteudo]` | Content-type code: `PDF`, `IMG`, `AUD`, `VID` | `rows[i].attributes["data-tipoconteudo"]` |
| Cell 0 | Source document date | `rows[i].cells[0]` |
| Cell 1 | Displayed name, e.g. `Requerimento` | `rows[i].cells[1]` |
| Cell 2 | Displayed type code | `rows[i].cells[2]` |
| Cell 3 | Claimed size, e.g. `29.875` or `0` | `rows[i].cells[3]` |
| Download anchor `title` | Richer label, e.g. `Comprovativo [Comprovativo]` | `rows[i].links[j].title` where class contains `downloadDocument` |
| Download anchor `href` | Captured UI action, commonly `javascript:` | `rows[i].links[j].href` |
| Download anchor `target` | Browser target such as `_blank` | `rows[i].links[j].target` |
| Download anchor `class` | UI hook identifying the action | `rows[i].links[j].class` |

Neither `procinfo` nor the HTML provides a verified file-content hash. Zero size
remains a reported value, not proof of an empty binary. The richer title is a
court-interface label, not an independently verified description of PDF content.

All HTML elements retain their tag and attribute pairs in `elements[]`, including
CSS classes/styles and accessibility attributes. These are preserved interface
evidence, not promoted domain fields. The raw bytes remain the authoritative
capture if parsing loses layout, comments, entities or text boundaries.

## PostgreSQL storage, table by table

There are no separate raw-case/raw-bucket/raw-document SQL tables. They share the
existing provenance tables, distinguished by observation and payload kinds.
The original saved-HTML registration is `source_capture.id = 2`.

### `casework.source_capture`

| Column | Stored value / semantics for this importer |
| --- | --- |
| `id` | Generated internal capture ID |
| `source_system` | `tribunais_org_pt` |
| `capture_kind` | `manual_source_capture` |
| `capture_key` | `saved-html:` plus source-manifest SHA-256 |
| `external_source_label` | Extracted run directory name |
| `captured_at` | Source capture/run start; nullable when unknown |
| `capture_ended_at` | Source capture end; null for this run |
| `capture_time_basis` | `inferred_run_label` for this run; timestamp is not verified per-row time |
| `scraper_key`, `scraper_version` | Null; original scraper implementation identity not invented |
| `source_locator` | Run directory label, not its absolute local path |
| `metadata_json` | `snapshot_sha256`, `extractor_sha256`, `loader_sha256`, `captured_at_semantics`, `order_policy` |
| `created_at` | Database insertion timestamp |

The manifest hashes ordered relative paths, sizes and file hashes. The snapshot
hash covers the serialized snapshot; extractor/loader hashes identify processors.
The original run time encoded in the label is stored as inferred source run start,
not verified row time. Original registration time is preserved in import history.

### `casework.import_execution`

One header per database import attempt, including retries. Its fields, historical
backfill and failure semantics are defined in the
[import execution dictionary](19-import-execution-and-source-time.md). It links
the source capture to execution timestamps, importer/input identity and results.
It does not replace the portable-package `import_batch` table.

### `casework.source_observation`

| Column | Stored value / semantics |
| --- | --- |
| `id` | Generated observation ID |
| `source_capture_id` | FK to capture |
| `observation_kind` | As listed in the source-file table above |
| `observation_key` | Relative file path; derived report uses `coverage-report` |
| `source_native_id` | First row's `data-procinfo`, else `data-proc`, else `data-idprocesso`; null when unavailable |
| `parent_source_native_id` | Context `data-proc` if available, otherwise context `data-idprocesso` |
| `source_path` | Relative file path; report uses `derived/coverage-report.json` |
| `display_title`, `display_status`, `display_date` | Not populated by this importer; values remain in payload |
| `payload_json` | Exact byte encoding plus parsed observations, or derived report |
| `observed_at` | Null: original individual observation timestamp unknown |
| `created_at` | Database insertion timestamp |

Current convenience-ID caveats: a case row's parent ID repeats its own case ID;
a bucket row's parent ID repeats its bucket ID. A full document table's native ID
comes from its first row. These are current loader behavior, **not semantic parent
edges or a table's stable domain identity**. Use `payload_json.context` and explicit
provenance links. Observation identity is capture + kind + path.

Every HTML payload has:

| JSON key | Meaning |
| --- | --- |
| `path`, `sha256`, `size` | Relative source path, exact-byte digest and byte length |
| `raw_base64` | Reversible encoding of the entire original file |
| `kind` | `case_row`, `bucket_row`, `document_row`, or `artifact` |
| `context.case` | Enclosing saved case-row attributes |
| `context.bucket` | Saved bucket-row attributes when available |
| `rows[]` | Parsed row `attributes`, ordered `cells`, anchor `links` |
| `elements[]` | All parsed start-tag names and attribute-pair lists |

The extra report observation contains `comparisons`, `unmatched`,
`unmodeled_attributes`, `coverage`, `summary`, scope and processor/snapshot hashes.
Each comparison records source path/hash, target ID, field, observed/current value
and assessment. `target_id` depends on row kind (case, bucket or document ID).
`observed_raw` here is the comparator input: sizes already lack separators; it is
not the original lexical bytes. The persisted report precedes post-insert
verification; local reports additionally carry capture ID and verification counts.

### `casework.source_observation_link`

| Column | Stored value / semantics |
| --- | --- |
| `id` | Generated link ID |
| `source_observation_id` | FK to exact saved row observation |
| `case_file_id` | Populated for uniquely matched case rows |
| `bucket_id` | Populated for uniquely matched bucket rows |
| `document_id` | Populated for uniquely matched individual document rows |
| `mapper_key` | `citius-html-exact-source-keys` |
| `mapper_version` | Executing loader SHA-256 |
| `mapped_at` | Database mapping timestamp |

Exactly one target FK is populated. No links are created for complete-table copies
or the report. There is no `bucket_document_id` FK here: document occurrence
context remains in the payload. Capture 2 has 2,976 links.

## Reading the data

Read-only example retrieving original document fields without conflating SQL kind
and payload kind:

```sql
SELECT o.id, o.source_path,
       o.payload_json #>> '{rows,0,attributes,data-procinfo}' AS procinfo,
       o.payload_json #>> '{rows,0,cells,3}' AS reported_size,
       o.payload_json ->> 'sha256' AS html_sha256
FROM casework.source_observation o
WHERE o.source_capture_id = 2
  AND o.payload_json ->> 'kind' = 'document_row';
```

Raw byte recovery uses PostgreSQL `decode(payload_json->>'raw_base64', 'base64')`.
That yields HTML bytes, not an image/PDF binary. Preserve the hash when exporting.
See [capture operations](16-saved-citius-html-provenance.md) and
[coverage findings](../discussions/2026-09-05-citius-html-coverage.md).
