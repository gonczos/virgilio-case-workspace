# Labelled-reference-v6 bounded evaluation

Status: implementation evaluation passed; independent review pending.

The v6 implementation preserves `labelled-reference-v5` unchanged and applies
only the corrections frozen in the v6 contract. The evaluation oracle includes
the attributable correction of prediction 133 from truncated `Doc nº5` to the
complete source span `Doc nº5- A`.

## Audit oracle

| Check | Result |
| --- | ---: |
| Expected exact or corrected observations | 170/170 |
| Rejected observations absent | 8/8 |
| Added coordination/range observations | 4/4 |
| PDF-dependent observations preserved unscored | 2/2 |
| Total oracle cases | 184/184 |
| No-prediction controls | 30/30 |

The eight absent observations are the seven ordinary-language captures and the
empty-field party-label spillover. The other eight v5 rejections are replaced
by four complete attachment spans and four numeric Citius observations.

## Regression fixtures

| Fixture | Exact positives | Missed | Spurious | Negative overlaps | Ambiguous overlaps |
| --- | ---: | ---: | ---: | ---: | ---: |
| Foundation | 18/18 | 0 | 0 | 0/15 | n/a |
| Capped expansion | 93/93 | 0 | 0 | 0/35 | 0/3 |

The two original-PDF-dependent values, `38477843-` and `1606407299`, remain
byte-for-span unchanged and are excluded from precision claims.

## Boundary

This is bounded evidence over frozen fixtures, the 180-prediction audit, and 30
controls. Unsupported identifier families remain not evaluated. No corpus
extraction, ingestion, API/UI change, target resolution, relationship
resolution, or database write was performed or authorized.

V6 remains open until an independent reviewer verifies oracle fidelity, rule
scope, provenance, regressions, and these metrics.
