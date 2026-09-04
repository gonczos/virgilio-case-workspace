# Metadata preservation and retrieval evaluation — version 2

Status: technical data checks passed; human confirmation pending

This checkpoint corrects the calendar-date serialization defect in version 1. PostgreSQL `DATE` values are now formatted as `YYYY-MM-DD` in SQL. They no longer pass through JavaScript `Date.toISOString()`, which shifted Lisbon summer dates to the preceding UTC day.

Frozen version-1 artifacts remain unchanged. Version 2 preserves their AI-simulation and attributable human-review decisions as historical evidence. It does not claim that a human has approved carrying those decisions onto the corrected fixture.

The technical comparison found only these selected assertion changes:

- `17136443`: `2020-07-15` → `2020-07-16`
- `121345333`: `2019-09-29` → `2019-09-30`
- `125804397`: `2020-07-05` → `2020-07-06`

The unchanged version-1 metric contract was rerun against version 2:

- Data checks: 24/24 passed
- Reused binary: 8/8
- Missing file: 8/8
- Ordinary binary linked: 8/8
- Normalization collisions: 0
- Human confirmation gate: pending
- Overall acceptance gate: not passed

Validation confirms deterministic regeneration, exact lineage hashes, preservation of all non-date selected-assertion data, historical review provenance, missing-file invariants, valid JSON, and read-only database access.

Artifact hashes:

- `metadata-selection.json`: `c6894ec919e2c6c1b2bd66678aa07880628811c40883cc5553b51593b7295f06`
- `metadata-reviewed-fixture-v2.json`: `b434bb2745e1824b020d3b59a700771927a660f01ecb6a536cd81d3026f65136`
- `manifest.json`: `bf655539f479916bd47e2de0aa3711df261b5fd74e4f66644a30812d94fe36fb`
- `metadata-baseline.json`: `5938d9e3fa2c8125786d78eb9d4c21e1ce1d58d7ff94280922cb29ec12208ec1`

Text extraction remains a separate track. No extractor, API, UI, ingestion path, processor, version-1 artifact, or database state was changed.
