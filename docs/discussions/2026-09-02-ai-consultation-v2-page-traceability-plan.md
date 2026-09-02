# AI consultation export v2: page traceability assessment and next slice

Date: 2026-09-02

Status: agreed implementation plan. This discussion records the evidence and
scope for the next bounded export improvement; it does not redefine canonical
evidence or authorize later semantic-enrichment work.

## Objective and invariants

Improve page-level consultation of the exported package before a full-corpus
export while preserving these invariants:

- original binaries remain immutable canonical evidence identified by full
  SHA-256;
- Docling and Xberg outputs remain independent, processor-attributed derived
  representations;
- no processor output is repaired, normalized, merged, or promoted to canonical
  truth;
- unavailable lineage is reported as unavailable rather than inferred;
- any future contents inventory remains separately attributed interpretation.

The acceptance fixture is the targeted-five factual slice and its v2 AI
consultation projection. The two scanned PDFs contain 99 of the fixture's 110
PDF pages, so useful page lineage for those documents has disproportionate
value.

## Findings

### Docling page provenance is available without reprocessing

The retained Docling `native.json` is the processor's structured document
export. Its content items carry `prov` entries containing PDF `page_no` and
bounding boxes.

| Binary | PDF pages | Inspected Docling items | Items with provenance | Pages represented |
|---|---:|---:|---:|---:|
| `02c8e7...` | 11 | 518 | 518 | 1-11 |
| `9d335b...` | 88 | 1,691 | 1,691 | 1-88 |

Existing Docling artifacts can therefore support a separately derived,
processor-attributed page-item projection without a Docling rerun. This does
not establish exact offsets from the existing `docling.md` back to pages:
Markdown rendering may reorder or transform native items. The page projection
must cite the native Docling item provenance and leave the Markdown unchanged.

### Current Xberg artifacts cannot support reliable page mapping

The Xberg adapter requests page extraction but sets `insert_page_markers` to
false. Its generic JSON conversion also falls back to `repr()` for the installed
Xberg extension objects. For both scanned PDFs the resulting `native.json` is a
154-byte object containing strings such as
`<builtins.ExtractedDocument object at ...>`. The retained text projections have
no form-feed or other reliable page delimiters.

Reliable Xberg mapping therefore requires a separate processor slice:

1. determine the structured/page API actually exposed by the installed Xberg;
2. persist supported fields explicitly and enable a reliable page boundary if
   available;
3. assign a new immutable processor/profile identity for the changed artifact
   contract;
4. rerun a targeted set including both scanned PDFs and a born-digital control;
5. validate page count, order, empty pages, OCR content, furniture, and tables.

Processing individual PDF pages is only a fallback. It can change whole-document
reading order, repeated-furniture handling, cross-page tables, and other output,
so it must not be presented as equivalent to the current Xberg run.

### Text presence and extraction quality are different observations

The current page record sets `has_meaningful_text` when at least one Unicode
letter or digit is present. The nearly empty attachment consequently reports
`true` for six alphanumeric characters. This measures presence, not meaning or
usable extraction quality.

The next contract should keep factual measurements separate from an explicitly
identified heuristic assessment:

| Proposed concept | Semantics |
|---|---|
| extracted character count | Raw extracted string length. |
| alphanumeric character count | Count of observed Unicode letters and digits. |
| text presence | `present`, `absent`, or `unknown`; no quality claim. |
| extraction volume assessment | `empty`, `nearly_empty`, `above_threshold`, or `not_assessed`. |
| assessment basis | Metric, configured threshold, and implementation identity. |

Passing a volume threshold does not establish correctness, completeness,
relevance, or semantic value. The term `meaningful` should not be used for this
measurement.

This change requires exporter, contract documentation, inspector/test, and
package-regeneration work, but no processor reruns.

### Exported dates are source calendar dates

The relevant PostgreSQL columns (`document_date`, `bucket_date`,
`data_autuacao`, and `data_decisao`) are `DATE`, not timestamp, values. They must
be exported as `YYYY-MM-DD` calendar dates without time-of-day or timezone
meaning.

Their field semantics must remain explicit:

- `document_date` is the date attributed to the source document record;
- `bucket_date` / occurrence date is the date attributed to the source-recorded
  procedural occurrence;
- `data_autuacao` is the source-recorded case opening or registration date;
- `data_decisao` is the source-recorded decision date.

These values do not prove an event time and must not make filing, signing,
receipt, occurrence, or decision dates interchangeable. The exporter currently
recovers the Portugal calendar date from intermediate JavaScript timestamp
serialization. That fixes the observed day shift, but a later portability
hardening may preserve PostgreSQL `DATE` strings at the query boundary rather
than round-tripping them through a timestamp.

Documenting the semantics and testing the existing output requires no
reprocessing.

### A mixed-bundle contents inventory is useful but interpretive

The current source model reliably records documents, binary associations,
bucket membership, procedural occurrences, source references, and process
numbers. `bucket_document` represents membership; it does not establish
semantic relationships such as `attached_to`, `translation_of`, `appeals`, or
`responds_to`.

A future contents inventory for the 88-page mixed bundle should be a separate
derived artifact. Each entry should retain at least:

- source binary SHA-256;
- stable inventory-item identity;
- PDF page range;
- attributed label or document type;
- relationship type, when asserted;
- basis: `source_recorded`, `human_inferred`, or `machine_inferred`;
- supporting source reference or passage;
- producer/version, review state, and uncertainty.

Source-recorded and inferred relationships should be separate records or
collections, not facts made indistinguishable by an optional annotation. A
manually reviewed pilot is feasible from the original PDF and Docling page
items. Corpus-wide automatic inventory generation is semantic enrichment and
is deliberately outside the next export slice.

## Agreed smallest useful implementation slice

Before the full export:

1. replace `has_meaningful_text` and related `meaningful` count terminology
   with factual text-presence/count fields and an explicit extraction-volume
   heuristic;
2. document and test the source-calendar-date semantics;
3. generate a separately attributed Docling page-item projection from existing
   `native.json` artifacts;
4. validate that projection on the two scanned PDFs, covering all 99 scanned
   pages, and use the other targeted documents as bounded controls;
5. keep Xberg page mapping explicitly `unavailable`, with the factual reason;
6. regenerate and inspect the targeted-five v2 package.

This slice does not require processor reruns or database-schema changes.
Expected effort is small-to-medium: approximately one to two focused engineering
days including schema/inspector updates, tests, regeneration, and manual review.

## Deferred work and limitations

- Xberg serialization correction and targeted reruns are a separate
  medium-to-high-effort processing slice.
- The Docling page projection provides lineage to native items, not guaranteed
  byte or character offsets in rendered Markdown.
- Bounding boxes and page numbers originate from Docling and remain attributed
  observations, not independent proof of OCR correctness.
- Extraction-volume thresholds are diagnostics only; they do not assess meaning
  or completeness.
- Contents inventories and semantic relationships remain deferred until page
  lineage exists and must never overwrite source metadata.

## Completion boundary for the next slice

The implementation stops after the targeted-five v2 package is regenerated,
inspected, and manually checked for the agreed fields and page projection. It
does not begin Xberg processor changes, Xberg reruns, contents-inventory
generation, reconciliation, relation discovery, or other AI enrichment.

## Follow-up decision: consultation projection versus native artifact

Review of the regenerated package confirmed that Docling page items preserve
some identifiers omitted by its readable Markdown, including page furniture.
For the AI-consultation use case, accessible page-linked identifiers have more
value than including the full technical native artifact by default.

The agreed contract is:

- the page projection states that it derives from Docling `native.json` and
  records the native artifact hash, processor version, and profile;
- the exporter confirms that the native artifact exists in the verified factual
  source package before producing the projection;
- the generated README states that the native artifact is retained in the
  source system/factual package but omitted from the consultation export;
- omission means the projection cannot be independently reconstructed from the
  consultation package alone;
- the original PDF remains included as canonical evidence for checking the
  document itself;
- including native artifacts may later become an explicit audit-export option,
  but is not part of the standard consultation package.

The next bounded implementation adds this explanation and a conservative,
machine-readable identifier-preservation inventory. The inventory may report
identifier-like strings present in the attributed Docling page projection but
absent from a readable processor output. It is a textual coverage comparison,
not a correctness, legal-significance, or substantive-disagreement assessment.
It must retain page and processor lineage, avoid synthetic merging, and leave
all original and processor artifacts unchanged.

## Final packaging slice: case orientation and unavailable binaries

The full source state contains 1,238 retained binaries, but it also contains 36
source-document records without an associated binary: 6 `AUD`, 11 `IMG`, and
19 `VID`. Each has a court-system document reference, source metadata, document
and occurrence dates, bucket context, and process linkage. Each has a claimed
size of zero. The database does not contain a dedicated field proving why the
binary is absent, so the export must use the factual status and basis
`no_binary_observed_and_claimed_size_zero`, not silently elevate collection
experience into a source-recorded reason.

The final bounded packaging change will add:

- `cases.csv`, one row per source-recorded case/process identifier represented
  by the selected binaries or unavailable source documents;
- `missing-source-documents.csv`, one row per source-document occurrence whose
  source document has no binary;
- matching manifest, coverage, README, inspector, and test support.

Case rows separate source-recorded fields from package-derived fields. Derived
binary counts use distinct SHA-256 identities; source-document counts use
distinct source document records; occurrence counts count exported occurrence
rows. First and last occurrence dates are bounds within the exported records,
not opening or closing dates of a proceeding. Shared binaries may count once in
each linked case while remaining one binary globally. Process suffixes remain
distinct identifiers. Absence of a suffix or process number from the exported
records does not establish nonexistence outside the export.

The factual package must carry the package-level case and missing-document
records so the consultation exporter remains a portable projection and does
not query PostgreSQL. No unavailable binary placeholder, inferred content, or
processor job will be created.

After regeneration and validation of the full 1,238-binary package, exporter
expansion stops. Richer questions about the remaining metadata should return to
the original direct, constrained metadata-consultation goal rather than adding
more duplicated projections to the portable package.

## Completion and transition

Completed on 2026-09-03.

The final full factual and AI-consultation packages were regenerated for all
1,238 available binaries. The consultation package contains five distinct
source case records, 36 distinct source documents without binaries, and 39
missing-document occurrence rows. Three `AUD` documents occur in both the main
proceeding and `-E`, explaining why occurrence rows exceed distinct missing
documents. The missing-document breakdown is 6 `AUD`, 11 `IMG`, and 19 `VID`.

The final consultation package inspection reported:

- package format `virgilio-ai-consultation`, version 2;
- 1,238 binary identities;
- 11,247 manifest-inventoried files with valid declared hashes and sizes;
- 487 actionable extraction diagnostics, preserved as diagnostics rather than
  claims that the affected documents are substantively unusable.

The implementation checkpoints were:

- `4606696` — document the page-traceability export plan;
- `c41cd54` — add Docling page traceability;
- `606af45` — document the consultation-projection provenance decision;
- `4e7bab1` — add identifier coverage;
- `60b897d` — stabilize identifier ordering for full exports;
- `78a87a3` — document the final packaging boundary;
- `3d5a976` — add case and missing-document indexes.

The package exporter is now considered complete for the agreed portable
consultation use case. Further attempts to mirror all relational metadata into
flat package indexes are deliberately deferred. The next phase should provide a
read-only, constrained AI consultation interface to authoritative metadata,
while continuing to use original binaries as canonical evidence and retaining
processor-specific derivation lineage.
