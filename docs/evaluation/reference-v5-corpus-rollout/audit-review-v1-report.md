# Labelled-reference-v5 corpus human audit

Status: complete; frozen ingestion gate failed.

The attributable reviewer `case_support_reviewer_attila_test_1` reviewed the
frozen 180-prediction sample and all 30 no-prediction segment controls through
guided inspection of their extracted source context. Decisions were recorded
without resolving targets or relationships and without modifying the extractor
or database.

## Prediction results

| Decision | Count |
| --- | ---: |
| Confirmed | 162 |
| Rejected | 16 |
| Requires original-PDF verification | 2 |
| Total | 180 |

The sampled false-positive rate is 8.89%. This exceeds both frozen limits: no
more than three rejected predictions and no more than 2% false positives.

The rejected predictions expose recurring bounded patterns: ordinary words
captured after linguistic uses of `referência`, the namespace word `Citius`
captured instead of its numeric identifier, and attachment suffixes omitted
from predicted spans. Prediction 133 was corrected through an attributable
follow-up after exact offsets showed that `Doc nº5` begins the source expression
`Doc nº5- A`; its original confirmation remains in decision history. The two
unresolved predictions preserve their extracted
values unchanged pending original-PDF verification.

## No-prediction controls

All 30 segment controls passed with zero confirmed missed surface forms
supported by v5. This result is limited to the frozen v5 taxonomy. It does not
establish recall for process numbers, French administrative identifiers,
payment or guide references, correspondence references, or court references
whose labels disappeared during text extraction.

Those unsupported and layout-dependent examples remain unscored diagnostics.
They should inform later family selection and document-view/PDF verification,
not alter this gate retrospectively.

## Separate recall observations

Four missed coordinated or range endpoints were noticed beside otherwise valid
sampled predictions: `26v.`, attachment endpoint `7`, folio `838`, and folio
endpoint `1103`. They are preserved as recall/error-analysis observations and
are not counted as sampled false positives or as failures in the independently
selected no-prediction controls.

## Decision

The human audit is complete, but corpus ingestion remains unauthorized. The
next bounded step is error analysis over the complete audit, followed by a
separately reviewed versioned extractor or sampling decision. No corpus write
should run against the failed v5 gate.
