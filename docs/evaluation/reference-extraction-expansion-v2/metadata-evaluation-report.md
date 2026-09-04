# Metadata preservation and retrieval evaluation — version 2

Status: acceptance gate passed

PostgreSQL `DATE` values are formatted as `YYYY-MM-DD` in SQL and no longer pass through JavaScript `Date.toISOString()`.

Frozen version-1 artifacts remain unchanged. Version 2 preserves their AI-simulation and attributable human-review decisions as historical evidence. A separate attributable human confirmation event approves inheritance of those decisions for the three corrected assertions, approves only the listed calendar-date changes, and leaves every target and relationship unresolved:

- `17136443`: `2020-07-15` → `2020-07-16`
- `121345333`: `2019-09-29` → `2019-09-30`
- `125804397`: `2020-07-05` → `2020-07-06`

The unchanged version-1 metric contract was rerun against version 2:

- Data checks: 24/24 passed
- Reused binary: 8/8
- Missing file: 8/8
- Ordinary binary linked: 8/8
- Normalization collisions: 0
- Human confirmation gate: passed
- Overall acceptance gate: passed

Validation confirms deterministic regeneration, exact lineage hashes, preservation of all non-date selected-assertion data, historical and correction review provenance, missing-file invariants, valid JSON, and read-only database access.

Artifact hashes:

- `metadata-selection.json`: `c6894ec919e2c6c1b2bd66678aa07880628811c40883cc5553b51593b7295f06`
- `metadata-reviewed-fixture-v2.json`: `74cb56a7385331c6fe6d9dbea65f4680e36ae2b637dd4cd641cd81291ee1a6bc`
- `manifest.json`: `1dcdf0fba2a2401868f06354aab5894f0f2f02f745d2a08ce248d297ef8b92ae`
- `metadata-baseline.json`: `0a98160ca1b18d75ff070b707dcc361c0c585207f037980c1205ca99bf6b9928`

Text extraction remains a separate track. No extractor, API, UI, ingestion path, processor, version-1 artifact, or database state was changed.
