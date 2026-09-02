# AI Consultation Package Format

## Purpose and boundary

`virgilio-ai-consultation` is a file-based projection for consulting court-case
documents with Codex, ChatGPT, or another AI. It is an inventory and diagnostic
format, not a preferred representation, reconciliation layer, semantic index, or
legal interpretation.

Original binaries are canonical evidence objects and retain their byte-for-byte
SHA-256 identity. Every extracted artifact is derived content attributed to its
processor and version. Independent outputs remain separate and must not be
silently merged.

## Version 2 layout and compatibility

- `manifest.json`: package identity and integrity inventory.
- `documents.csv`: one navigation row per binary SHA-256.
- `occurrences.csv`: one chronological row per source-recorded procedural
  occurrence.
- `coverage.json`: selected-scope inclusion and processor-state coverage.
- `documents/<sha256>/original.*`: canonical original binary.
- `documents/<sha256>/metadata.json`: complete linked source context, artifact
  provenance, source characteristics, and structured diagnostics.
- `documents/<sha256>/evidence/`: literal PDF text, structure inventory, and
  signature metadata.
- `documents/<sha256>/interpretations/`: independent Docling and Xberg outputs.
- `documents/<sha256>/page-traceability.json`: source page observations and
  processor-specific page-mapping availability.
- `documents/<sha256>/warnings.md`: optional human rendering of actionable
  diagnostics from `metadata.json`.

The top-level manifest uses `package_format = "virgilio-ai-consultation"` and
`package_version = 2`. It records generation time, exporter identity, binary
count, index and document-root paths, `sha256` as the hash algorithm, original
inclusion, limitations, stable document identities, and hashes/sizes for every
other package file. All paths are relative and must remain within the package.
The inspector continues to accept version 1 packages; new exports use version 2.

## Index semantics

`documents.csv` is an entry point, not complete provenance. It remains one row
per binary. `process_numbers`, `source_document_count`, and `occurrence_count`
are aggregates. Fields prefixed with `representative_` are display values from
the first deterministically ordered linked context. Consumers must read the
binary's `metadata.json` for every source document, process number, and
procedural occurrence.

`occurrences.csv` is the complete package-level chronology projection. Source
calendar dates use `YYYY-MM-DD` and are not converted into UTC instants. Actual
generation and processing instants remain timestamps. `display_label` and the
`navigation_label` object are generated, non-authoritative navigation aids;
neither changes document identity or source metadata.

## Artifact provenance and channels

Every `extracted_artifacts` item records `artifact_kind`, `processor`,
`processor_version`, package-relative path, source binary SHA-256, and available
extraction/OCR method information. The format keeps these channels distinct:

- literal PDF text;
- PDF structure inventory;
- PDF signature metadata;
- OCR or image-derived processor output;
- Docling interpretation;
- Xberg interpretation.

No channel is universally preferred. Outputs are copied unchanged from the
verified factual package; normalization is used transiently only for diagnostic
comparison.

Page traceability is independently described for each processor. Literal PDF
text uses extractor-emitted form-feed boundaries as PDF page indexes. Printed
page labels remain `not_observed`. Docling and Xberg consultation artifacts are
marked with unavailable page mapping unless their included artifact contract
provides a reliable boundary; reported page counts are not silently treated as
passage-to-page lineage. Per-page OCR use is `unknown` when not provided.

## Diagnostics

`metadata.json.diagnostics` is the source of truth. `warnings.md` contains only
diagnostics with `actionable = true` and is omitted when none exist. Informational
diagnostics intentionally have no severity. Current stable codes are:

| Code | Meaning | Actionable |
|---|---|---|
| `PROCESSOR_OUTPUT_AVAILABLE` | Declared artifact exists, is readable, and contains eligible output. | No |
| `PROCESSOR_NOT_APPLICABLE` | Channel is known not to apply to the source MIME type. | No |
| `PROCESSOR_OUTPUT_UNKNOWN` | No artifact exists and persisted data cannot distinguish not-run from another unavailable state. | No |
| `PROCESSOR_JOB_FAILED` | A persisted job failed and no eligible artifact is included. | Yes |
| `PROCESSOR_OUTPUT_EMPTY` | Selected artifact has zero bytes or no letters/digits. | Yes |
| `PROCESSOR_OUTPUT_NEARLY_EMPTY` | Text has fewer than 100 letters/digits. | Yes |
| `SOURCE_PDF_NO_NATIVE_TEXT` | Imported source assessment classifies the PDF as image-only. | No |
| `SOURCE_PDF_RASTER_CONTENT_PRESENT` | Structure evidence reports raster page content. | No |
| `INCOMPLETE_PAGE_COVERAGE` | Representation reports fewer pages than the source PDF. | Yes |
| `DECLARED_ARTIFACT_MISSING` | Representation declares a selected file that is absent. | Yes |
| `PROCESSOR_OUTPUTS_TEXTUALLY_NON_IDENTICAL` | Eligible Docling and Xberg text differ after conservative whitespace normalization. Substantive disagreement was not assessed. | No |
| `LARGE_TEXT_COVERAGE_DIFFERENCE` | Smaller interpretation has less than 65% of the meaningful characters of the larger. | Yes |

Textual non-identity is not substantive disagreement. Initial-line differences,
layout, typography, accents, and ordinary OCR variation do not create a warning
or conflict classification. A textual diff may be retained elsewhere as a
processor-attributed diagnostic, but it is not a severity basis.

`failed`, `not_applicable`, `empty`, `nearly_empty`, `available`, and `unknown`
are distinct states. The exporter never guesses `failed` or `not_applicable` when
the persisted evidence supports only `unknown`.

## Inspection

`inspect-ai-consultation` validates the format/version, deterministic and unique
SHA-256 document identities, path containment, file hashes and sizes, original
binary identity, artifact inventory membership, and artifact-to-binary lineage.
An integrity failure invalidates the package for consultation until it is
regenerated or repaired from immutable source artifacts.

## Implemented pre-full-export improvements

Version 2 implements the agreed packaging improvements in this order:

| Priority | Improvement | Implemented boundary |
|---|---|---|
| 1 | Correct date semantics. | Preserve source calendar dates as calendar dates. Do not serialize them as shifted UTC timestamps; retain timezone information only for actual instants. |
| 2 | Add a chronological `occurrences.csv`. | One row per source-recorded procedural occurrence, linked to the full binary SHA-256 and source document reference. This is a navigation projection, not a new identity model. |
| 3 | Add a package coverage report. | Report selection scope, included binaries, source documents without binaries, unavailable outputs, failed jobs, and unknown states. Do not infer completeness that the source data cannot prove. |
| 4 | Add page-level traceability and coverage where supported. | Preserve processor-specific page boundaries, distinguish PDF page index from printed page label, record meaningful-text counts and OCR method per page when available, and use `unknown` when the processor does not provide reliable page lineage. |
| 5 | Clarify warning and signature semantics. | State that “no actionable warnings” means only that no configured diagnostic fired. Keep signature fields, cryptographic signature observations/validation, and visible handwritten signature images as distinct concepts. |
| 6 | Add readable document labels. | Labels are navigation aids only. Full SHA-256 remains the binary identity, and labels must not overwrite or reinterpret source metadata. |

Page-linked extraction is the highest-value consultation improvement because it
enables verification and citation against an original PDF. Date semantics are
the first implementation priority because the current projection can render a
source calendar date as the previous day's UTC timestamp, directly misleading a
chronology.

Page diagnostics must remain observational. Low text count, OCR use, or an
unavailable page mapping may flag verification work, but does not establish that
a page was understood correctly or that its contents are unimportant.

Before full-corpus generation, the targeted-five sample is regenerated and
inspected with version 2. A further bounded sample should cover conditions
not represented by those five, including non-PDF formats, failed-only processors,
mixed native/raster pages, a binary linked to multiple source documents, and
unresolved source documents without binaries.

## Deliberately deferred interpretation work

The following ideas may be valuable later but are outside the pre-export
packaging phase:

- a contents inventory that subdivides a compound filing;
- semantic relationships such as “attached to”, “translation of”, “appeals”, or
  “responds to”.

These are derived interpretations unless explicitly recorded by the source.
They require separate producer attribution, exact page-level lineage, uncertainty
handling, and must not be written back as canonical document metadata. No LLM,
semantic-enrichment, reconciliation, or relation-discovery implementation is
authorized by recording them here.
