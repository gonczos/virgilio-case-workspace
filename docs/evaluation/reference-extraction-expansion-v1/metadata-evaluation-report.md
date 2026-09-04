# Metadata preservation and retrieval baseline

Status: completed with one bounded finding; acceptance gate not met

Protocol: `reference-expansion-v1`

Frozen manifest commit: `45f72f5`

## Scope

This report evaluates only the 24 human-reviewed metadata assertions in
`metadata-reviewed-fixture-v1.json`. It uses read-only PostgreSQL queries and
the existing `lookupRecordedReferences` contract with full scope and history
included. It does not evaluate text extraction, resolve targets, modify
metadata ingestion, or write database state.

Reproduce from the repository root with:

```powershell
node app/evaluate-reference-expansion-metadata.mjs
```

The machine-readable result is `metadata-baseline.json`.

## Result

The overall acceptance gate did not pass: 21 of 24 assertions passed every
check. The only failures are directly anchored occurrence dates for three
ordinary binary-linked controls.

| Reference | Frozen date | Retrieved date |
|---|---|---|
| `17136443` | `2020-07-15` | `2020-07-16` |
| `121345333` | `2019-09-29` | `2019-09-30` |
| `125804397` | `2020-07-05` | `2020-07-06` |

The current observation rows and lookup API agree on the retrieved dates. The
frozen fixture is one day earlier in each case. This pattern is consistent with
a date-to-UTC conversion error during inventory serialization, but that cause
is an inference and was not changed or repaired during this evaluation.

## Separate metadata metrics

All 24 assertions passed these checks:

- exact raw-value preservation;
- exact normalized-value and normalization-identity preservation;
- stable source-assertion identity and exactly one current row;
- source origin, source field, and identifier-type preservation;
- current/history lifecycle correctness;
- binary-availability classification;
- associated binary SHA-256 identity;
- retrieval of every expected occurrence context, including all reused-binary
  contexts frozen in the fixture;
- missing-file retention with no associated binary or fabricated open action;
- lookup by raw and normalized value; and
- repeated deterministic ordering consistent with the API ordering contract.

Direct anchor preservation passed 21 of 24 assertions because of the three date
mismatches above. The sample contains no normalization collision. Raw and
normalized values happen to be identical for all 24 selected assertions, so the
two lookup executions do not test a normalization-changing example.

By stratum:

- reused binary: 8/8 fully passed;
- missing file: 8/8 fully passed;
- ordinary binary-linked control: 5/8 fully passed.

## Finding

**P1 — Three frozen directly anchored dates are one day earlier than the source
rows and retrieval API.** The protocol requires 100% stable source-anchor
preservation, so the metadata checkpoint cannot be reported as accepted. The
frozen artifacts should remain immutable. Investigate the date serialization
path that produced `metadata-selection.json`; if the inventory dates are
confirmed erroneous, create a versioned correction with explicit lineage and
rerun this unchanged evaluation.

## Limitations

This is a frozen-sample evaluation, not a corpus-wide quality claim. It checks
preservation and retrieval only. It does not judge the meaning of identifiers,
target resolution, or text-span extraction performance.
