# Text and reference retrieval coverage measurement

Measured: 2026-09-03 13:31 Europe/Lisbon

## Purpose

This read-only measurement separates the existing global text-search projection
from the bounded reference-observation pilot. It informs a later scope-widening
decision and does not widen either API endpoint.

## Coverage

| Measure | Result | Meaning |
|---|---:|---|
| Corpus binaries | 1,238 | Current database population |
| Binaries with at least one text segment | 1,238 | A segment exists; this is not a quality assessment |
| Binaries with at least one nonblank segment | 1,238 | Some indexed text exists; completeness is not established |
| Representations with segments | 3,706 | Processor-attributed representations remain separate |
| Segments | 3,706 | Current segments are predominantly one per representation |
| Nonblank segments | 3,638 | 68 representation segments are blank |
| Page-located segments | 0 | Current text hits are document-level |
| Verified PDF-page segments | 0 | No text hit can currently claim a verified PDF page |
| Reference observations | 57 | All are attributed to the frozen pilot |
| Distinct observed reference values | 47 | Observed values, not resolved targets |
| Binaries linked to observations | 15 | The frozen available-binary fixture |
| Observations without a binary | 4 | Includes source/metadata records; not missing documents |

### Text segments by processor

| Processor | Binaries | Representations | Segments | Nonblank segments |
|---|---:|---:|---:|---:|
| Docling | 1,238 | 1,239 | 1,239 | 1,218 |
| PDF literal text | 1,238 | 1,238 | 1,238 | 1,238 |
| Xberg | 1,229 | 1,229 | 1,229 | 1,182 |

These counts measure stored segment presence, not meaningful-text quality,
complete page coverage, or processor correctness. In particular, a nonblank
literal-text segment can still contain extremely little useful text.

## Narrow performance observation

On the current local database, a warm `despacho` full-text query limited to 50
segment IDs reported 0.118 ms execution time, and exact lookup of `105398957`
reported 0.011 ms. These are single local `EXPLAIN ANALYZE` observations, not a
load test or portable performance guarantee.

## Decision implication

The global PostgreSQL text projection is already populated across the current
binary collection, although all current locations are document-level. Expanding
text retrieval is therefore mainly a query-scope, ranking, response-size, and
usability decision rather than another indexing build.

Reference lookup is different: its observations remain limited to the 15-binary
fixture. A failed reference lookup outside that fixture says nothing about
whether a document exists or whether its text is searchable. Reference
observation population must be planned and measured separately from widening
text search.
