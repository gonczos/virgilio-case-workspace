# Labelled-reference-v5 corpus audit error analysis

Date: 2026-09-04

## Scope

This analysis uses the immutable sample
`audit-sample-v1.json` and completed attributable review
`audit-review-v1.json`. It classifies the observed v5 errors and defines the
evidence boundary for a later versioned correction. It does not modify
`labelled-reference-v5`, run extraction, authorize ingestion, or reinterpret
the frozen audit gate.

The prediction sample contains 163 confirmed predictions, 15 rejected
predictions, and two predictions requiring original-PDF verification. The
frozen gate rate remains 15/180, or 8.33%. When the two unresolved predictions
are excluded from adjudicated precision, v5 has 163 true positives among 178
decided predictions: 91.57% precision, with an 8.43% decided-prediction error
rate. The unresolved predictions are neither true nor false positives.

## False-positive and boundary-error classes

| Error class | Existing rule | Count | Sample numbers | Required behavior |
| --- | --- | ---: | --- | --- |
| Ordinary-language capture | `reference-labelled-v3` | 7 | 17, 32, 36, 46, 56, 77, 114 | Do not emit `deste` or `sequer` as identifiers. |
| Namespace captured as value | `reference-labelled-v3` | 4 | 23, 70, 78, 106 | Treat `Ref.º Citius:` as a combined label and inspect the following identifier; do not emit `Citius`. |
| Empty-field spillover | `reference-labelled-v3` | 1 | 129 | Do not cross an empty reference field and emit the following party label `Requerente`. |
| Attachment suffix omitted | `local-attachment-doc-v1` | 3 | 4, 102, 127 | Preserve the complete `A` suffix in `DOC Nº 14 A`, `DOC Nº 13-A`, and `Docnº18-A`. |

The first three classes account for all 12 rejected predictions from
`reference-labelled-v3`. Every confirmed prediction produced by the generic or
cited labelled-reference rules contains at least one digit. This supports a
narrow digit-bearing value constraint for the evaluated corpus, but it does
not establish that alphabetic reference values never exist. Alphabetic-only
reference families remain unsupported and must be reported as not evaluated.

For the four `Citius` errors, the directly following numeric values are
`8656497` in two representation-specific observations and `651161` in two
others. The broader lists following `8656497` are not part of this correction:
their punctuation and coordination were not exhaustively reviewed as an
independent family.

The attachment errors are exact-span errors rather than evidence that no
attachment exists. A corrected prediction replaces each truncated observation;
it must not coexist as a second current observation at the same source
assertion during any later lifecycle plan.

## Separate recall findings

Four misses were identified beside valid sampled predictions. They are not
sampled false positives and do not change the 30 independently selected
no-prediction controls.

| Source prediction | Missed span | Failure class | Source construction |
| ---: | --- | --- | --- |
| 75 | `26v.` | Coordinated folio continuation | `fls. 25 e 26v.` |
| 116 | `7` | Attachment range endpoint | `Doc nº1 a 7` |
| 141 | `838` | Coordinated folio continuation | `fls. 837 e 838` |
| 142 | `1103` | Compact folio range endpoint | `fls 1055/1103` |

Each missing endpoint requires its own span and inherited-label provenance.
The first predicted endpoint remains a valid independent observation. The
continuation does not establish a target, document identity, binary identity,
or resolved range relationship.

## Pending original-PDF verification

Predictions 8 (`38477843-`) and 115 (`1606407299`) remain outside confirmed
precision calculations. Their reference semantics are supported, but exact
transcription is unresolved. A versioned correction must preserve the extracted
values and must not use either case as training evidence for punctuation repair,
digit deletion, or normalization.

## No-prediction controls and unsupported families

All 30 controls contain zero confirmed missed surface forms supported by v5.
They nevertheless expose unscored candidates involving process numbers, French
administrative identifiers, payment and guide references, correspondence
references, and probable court references whose labels were lost in flattened
text. These examples remain diagnostics. This correction must not add those
families or claim recall for them.

## Conclusion

The complete error profile supports a deterministic, narrowly versioned
correction. The failures arise from bounded token grammar, namespace handling,
suffix boundaries, and explicit coordination/range forms. No AI extraction
layer is justified by these errors. The implementation contract is frozen in
`docs/architecture/13-labelled-reference-v6-correction-plan.md`.
