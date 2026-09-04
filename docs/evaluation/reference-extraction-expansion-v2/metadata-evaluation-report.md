# Metadata preservation and retrieval evaluation — version 2

Status: acceptance gate passed

This checkpoint corrects the calendar-date serialization defect in version 1. PostgreSQL `DATE` values are now formatted as `YYYY-MM-DD` in SQL. They no longer pass through JavaScript `Date.toISOString()`, which shifted Lisbon summer dates to the preceding UTC day.

Frozen version-1 artifacts remain unchanged. Version 2 carries their AI-simulation and attributable human-review decisions as historical evidence. The correction confirmation records that only these selected assertion fields changed:

- `17136443`: `2020-07-15` → `2020-07-16`
- `121345333`: `2019-09-29` → `2019-09-30`
- `125804397`: `2020-07-05` → `2020-07-06`

The unchanged version-1 metric contract was rerun against the version-2 fixture:

- Assertions: 24
- Passed: 24
- Failed: 0
- Reused binary: 8/8
- Missing file: 8/8
- Ordinary binary linked: 8/8
- Normalization collisions: 0
- Acceptance gate: passed

Validation also confirms deterministic regeneration, exact lineage hashes, preservation of all non-date selected-assertion data, review provenance, missing-file invariants, valid JSON, and read-only database access.

Artifact hashes:

- `metadata-selection.json`: `c6894ec919e2c6c1b2bd66678aa07880628811c40883cc5553b51593b7295f06`
- `metadata-reviewed-fixture-v2.json`: `04d201e219783decc2607befb28b57ed794ff14205df37100a4b26b21d5c5b0b`
- `manifest.json`: `3c49b7183fe9ab3cc065481e6eeb399b93a9b0b5e0208a924105c6a9c3529b84`
- `metadata-baseline.json`: `d9df46067fd977f7d51489ad8fd541bdc4b9c02df0ea2862d9dcc6834083d21e`

Commands:

```powershell
npm run reference:build-expansion-metadata-v2
npm run reference:validate-expansion-metadata-v2
npm run reference:evaluate-expansion-metadata-v2
```

Text extraction remains a separate track. No extractor, API, UI, ingestion path, processor, or database state was changed.
