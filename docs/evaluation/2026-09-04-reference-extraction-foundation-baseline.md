# Deterministic legal-reference extraction baseline

Date: 2026-09-04

## Scope

This baseline evaluates the unchanged `extractLabelledReferences` implementation
against the frozen exhaustive scope
`representation-6038-chronological-entries-a-through-n-v1` only:
representation 6038, Unicode code-point range `[6822, 8619)`.

The ground truth contains 33 independently evaluated spans: 16 procedural
references, two local attachments, and 15 date negatives. Results must not be
presented as representation-wide, document-wide, family-wide, or corpus-wide
performance.

## Reproduction

With the consultation API available at `http://localhost:8091`:

```powershell
npm run reference:evaluate-foundation
```

The command verifies the representation-content SHA-256 before evaluation and
writes the complete machine-readable result to
`docs/evaluation/reference-extraction-foundation-baseline.json`.

## Frozen inputs and extractor identity

- Representation: `6038`
- Range: `[6822, 8619)` using zero-based, half-open Unicode code-point offsets
- Representation-content SHA-256: `a0799b74106cc7c9d60a648d48ea342952a1489e33b1cc4c878173487cb16bb4`
- Fixture SHA-256: `808ceffdb1b6dfc1e12cfd65abeec1fd355f001c02310acc4d76fd1d25269c46`
- Extractor key: `app/reference-search-store.mjs`
- Extractor version: `labelled-reference-v3`
- Configuration: built-in static patterns; no external configuration
- Extractor-function source SHA-256: `3bdc65e1d569c71e0d5377f84bc5dae776c2bbdeb199c7fb0fc49443f072931e`

No extractor behavior was changed for this baseline.

## Results

| Family | Gold positives | Exact | Partial/overlapping | Missed | Recall | Exact-span recall |
|---|---:|---:|---:|---:|---:|---:|
| Procedural | 16 | 15 | 0 | 1 | 93.75% | 93.75% |
| Attachment | 2 | 0 | 0 | 2 | 0% | 0% |
| Overall | 18 | 15 | 0 | 3 | 83.33% | 83.33% |

The extractor emitted 15 predictions. Every prediction was an exact positive
match. There were no partial or overlapping matches, no spurious predictions,
and no predictions overlapping any of the 15 reviewed date negatives.

## Misses

- `a011`, `122178618`, `[7146, 7155)`: the second value in the coordinated
  expression `referência citius: 122170551 e 122178618`. The current extractor
  recognizes the value immediately following the label but does not propagate
  that label across the coordination.
- `a020`, `Doc nº Doc 25`, `[7993, 8006)`: local attachment reference. The
  current extractor has no attachment-reference pattern.
- `a025`, `25 A`, `[8009, 8013)`: coordinated local attachment reference. The
  current extractor neither recognizes attachment labels nor propagates their
  semantics to coordinated values.

## Interpretation boundary

This result measures span extraction only. It does not measure namespace
resolution, transcription correction, target resolution, document identity,
binary identity, legal interpretation, or PDF-page location. The absence of
date false positives is established only for the 15 reviewed date spans inside
this exact scope.