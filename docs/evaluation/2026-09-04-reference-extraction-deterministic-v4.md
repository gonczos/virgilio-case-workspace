# Deterministic legal-reference extraction v4 evaluation

Date: 2026-09-04

## Change

`labelled-reference-v4` adds two bounded deterministic extensions:

- a second procedural value inherits an explicit reference label only in the
  reviewed `value e value respectivamente` construction; and
- the reviewed `Doc nº Doc 25 e 25 A` construction emits two independent local
  attachment observations.

Every prediction now carries a stable `rule_key` and structured
`label_provenance`. Direct predictions identify their label span. Coordinated
predictions state that the label was inherited and retain the coordination cue
and preceding value. Pilot ingestion stores this information in observation
metadata. No target, document, binary, or procedural relationship is resolved
by these rules.

## Frozen evaluation

Command:

```powershell
npm run reference:evaluate-foundation
```

The command evaluates representation 6038 range `[6822, 8619)` against the
unchanged 33-span fixture and writes
`docs/evaluation/reference-extraction-foundation-deterministic-v4.json`. The
historical v3 baseline artifact remains unchanged.

- Representation-content SHA-256: `a0799b74106cc7c9d60a648d48ea342952a1489e33b1cc4c878173487cb16bb4`
- Fixture SHA-256: `808ceffdb1b6dfc1e12cfd65abeec1fd355f001c02310acc4d76fd1d25269c46`
- Extractor-function source SHA-256: `1f6649fa831c44740dede460697385156486c8c88b0e2f9a428af4df513184b0`

| Family | Exact | Partial/overlapping | Missed | Exact-span recall |
|---|---:|---:|---:|---:|
| Procedural | 16/16 | 0 | 0 | 100% |
| Attachment | 2/2 | 0 | 0 | 100% |
| Overall | 18/18 | 0 | 0 | 100% |

The extractor emitted 18 predictions. All were exact positive matches. It
produced no spurious predictions and overlapped none of the 15 reviewed date
negatives.

Prediction attribution was complete:

- `cited-reference-labelled-v3`: 7
- `reference-labelled-v3`: 8
- `procedural-coordination-respectivamente-v1`: 1
- `local-attachment-duplicated-doc-v1`: 1
- `local-attachment-coordination-v1`: 1

## Diagnostic probe

The new rule keys were probed without scoring over complete fixture
representations 6038 and 4950. They emitted only the three expected observations
in representation 6038 and none in representation 4950. Since the complete
representations are not exhaustively annotated, this is an unexpected-match
probe rather than a precision claim.

## Boundary

The 100% result applies only to the exact exhaustive range and candidate
definition. The rules remain deliberately narrow. Broader conjunctions,
general attachment grammar, OCR correction, corpus-wide performance, and AI
comparison remain outside this change.