# Labelled-reference-v4 expansion text baseline

Date: 2026-09-04

This report evaluates the unchanged `labelled-reference-v4` extractor against the frozen, exhaustively reviewed `reference-extraction-expansion-text-v1` fixture. It covers only text-span extraction. It does not evaluate metadata preservation or retrieval.

## Frozen inputs

- Protocol: `reference-expansion-v1`
- Manifest checkpoint: `45f72f5`
- Fixture: `text-reviewed-fixture-v1.json`
- Fixture SHA-256: `2bbaee48b3753680b07c2297050c485d1c8142a114d34e4338fc377ea0fd7d11`
- Scope: 12 exhaustive ranges, 131 reviewed observations
- Extractor: `app/reference-search-store.mjs`, `labelled-reference-v4`
- Configuration: built-in static patterns with no external configuration
- Command: `npm run reference:evaluate-expansion-text`

The runner verified every representation-content SHA-256 before extraction and evaluated each range independently using zero-based, half-open Unicode code-point offsets.

## Results

The extractor produced no predictions in the 12 ranges.

| Family | Gold positives | Exact | Partial/overlap | Missed | Exact-span recall |
|---|---:|---:|---:|---:|---:|
| Local attachment | 28 | 0 | 0 | 28 | 0% |
| Physical folio | 63 | 0 | 0 | 63 | 0% |
| External register | 1 | 0 | 0 | 1 | 0% |
| External police register | 1 | 0 | 0 | 1 | 0% |
| **Overall** | **93** | **0** | **0** | **93** | **0%** |

Exact-span precision is undefined because the extractor returned zero predictions. Classification and normalization accuracy are also `not_evaluated`, because there were no exact predictions to classify or normalize. There were no spurious or partial predictions.

All 35 reviewed negatives had zero overlapping predictions. This includes sheet counts, dates/years, layout and pagination indicators, chemical names, a measurement, list numbers, a version designation, an organizational-unit expression, an assessment name, and the out-of-scope internal structural cross-reference.

The following frozen families had no reviewed positive denominator and remain `not_evaluated`: French RG, French Portalis, French pourvoi, Portuguese ECLI, French ECLI, and EU case identifiers.

## Interpretation

The result establishes a clean capability gap. Version 4's existing narrow patterns do not recognize the selected attachment spellings, physical-folio notation, or external-register forms. Its silence also means it introduced no false positives on the reviewed confusable negatives. The result does not support a precision claim: returning no predictions makes precision undefined rather than perfect.

This baseline falls below the protocol's 95% exact-span recall threshold for every evaluated positive family. The frozen sample must remain unchanged. Any subsequent deterministic refinement should be proposed and evaluated as a separate checkpoint, retain this baseline, pass the foundation regression fixture, and introduce no protected-negative false positives.

## Artifact

Machine-readable results, including every missed gold span, all range and representation hashes, extractor source hash, family metrics, negative-kind counts, and the empty raw-prediction list, are stored in `labelled-reference-v4-baseline.json`.

No extractor, fixture, manifest, metadata artifact, database state, API, UI, ingestion path, or processor implementation was changed during this evaluation.
