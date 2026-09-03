# Full-corpus text-search experiment — 2026-09-03

## Purpose and method

This is a bounded retrieval evaluation, not corpus curation or a claim that the
extractors are authoritative. The frozen fixture contains 12 queries: ten with
predeclared expected binaries and two exploratory queries excluded from the
pass rate. A known-target query passes when every expected SHA-256 appears
within the first ten distinct binaries and its canonical original is readable.
Processor passages remain independent and can consume the passage limit.

The 9/10 result below was measured with a 100-passage evaluator limit. The UI
requests 50 passages, so this is not yet the UI-equivalent score. An accepted
follow-up will rerun this unchanged fixture with a 50-passage override and
record both configurations separately.

The evaluator uses PostgreSQL `websearch_to_tsquery('portuguese', ...)` through
the same search function used by the API. Quoted queries therefore exercise
that parser's syntax; the UI does not advertise a separate guaranteed-verbatim
mode.

## Coverage

| Measure | Result |
| --- | ---: |
| Stored segments | 3,706 |
| Indexed segments | 3,706 |
| Indexed representations | 3,706 |
| Indexed binaries | 1,238 |

This measures the stored search projection. It does not prove extraction
completeness, OCR accuracy, or reference-observation coverage.

## Known-target results

| Query | Category | OCR-dependent | Expected distinct-binary rank(s) | Latency | Result |
| --- | --- | ---: | ---: | ---: | --- |
| `105398957` | reference-number text | no | 1, 2 | 15.1 ms | pass |
| `17964927` | reference-number text | no | 1 | 4.1 ms | pass |
| `Marianne intérprete` | keyword | no | 24 | 108.4 ms | **fail** |
| `39176427` | reference-number text | no | 3 | 42.2 ms | pass |
| `"efeito suspensivo"` | quoted text | no | 2 | 138.4 ms | pass |
| `134937241` | reference-number text | no | 2 | 13.0 ms | pass |
| `"perícia psicológica aos menores"` | quoted text | no | 3 | 57.7 ms | pass |
| `965 222 111` | reference-number text | yes | 9 | 133.1 ms | pass |
| `BAT 720185` | keyword | yes | 2 | 15.4 ms | pass |
| `"ATTESTATION DE TRADUCTION"` | quoted text | yes | 2 | 46.1 ms | pass |

Result: 9/10 counted queries passed. The result is intentionally retained as
observed; the fixture was not revised after the rank-24 failure.

The two exploratory searches, `alienação parental` and `Segurança Social`, each
reached the 100-passage cap. They are useful for inspecting breadth and cap
wording but are not acceptance passes because no expected result set was fixed
in advance.

## Original access and UI checks

All eight distinct expected SHA-256 originals were readable through the
canonical binary store. A narrow HTTP check of the binary gateway returned
`200 application/pdf` for each one. UI unit tests and the production build
passed. A browser check through `http://localhost` confirmed that Text exposes
the separate Pilot/Full corpus scope, labels the submitted scope, reports
passage and distinct-binary counts, groups processor hits under binaries, and
navigates the expected scanned-bundle result to its SHA-based detail page with
the original PDF viewer.

## Decision and limitation

Full-corpus Text search is useful enough to retain as an explicit experimental
scope, including for the two scanned PDFs. It does not yet satisfy the complete
retrieval gate because a known Ata ranked 24th for a broad two-term query.
Reference lookup remains pilot-only and is labelled separately.

The smallest next search slice is a ranking experiment focused on binary-level
deduplication and term coordination. It should use this unchanged fixture and
must not silently merge processor outputs, alter canonical evidence, or expand
reference ingestion.
