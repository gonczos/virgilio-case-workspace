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
