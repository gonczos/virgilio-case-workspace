# Labelled-reference-v5 corpus inventory v1

This is the read-only dry-run checkpoint authorized by architecture commit
`3692b46`. It does not authorize or perform corpus ingestion.

The command is:

```text
npm run reference:inventory:v5-corpus -- --output docs/evaluation/reference-v5-corpus-rollout/inventory-v1.json
```

The command runs in a PostgreSQL `REPEATABLE READ READ ONLY` transaction. Its
SQL contains only `SELECT`, `BEGIN`, and `ROLLBACK`; it calls no sequence
function and allocates no database identity.

## Measured result

- Eligible representations: 3,637 across 1,238 binaries.
- Eligible stored segments: 3,637, all nonempty.
- Eligible text: 25,694,331 Unicode code points.
- Excluded representations: 2,545: 2,477 processor identities outside the
  allowlist and 68 allowlisted representations without nonempty text.
- Predicted observations: 16,465 with 16,465 distinct deterministic keys and
  no duplicate key.
- Predicted coverage: 2,358 representations and 864 binaries.
- Existing fixture overlap: 111 observations, preserved as fixture-owned.
- Projected new inserts: 16,354.
- Projected reactivations, supersessions, retirements, and blocked cases: zero.
- Frozen planning batches at 500 predictions: 33 batches; the last contains
  465 predictions.
- Serialized prediction payload: 15,851,473 bytes. This excludes PostgreSQL
  tuple, JSONB, index, lifecycle-event, and transaction overhead.

Predictions by processor are 5,201 Docling, 5,962 literal-text, and 5,302
Xberg. The largest representation has 332 observations; the largest binary has
964 across its independent representations. The p95/p99 counts are 30/117 per
representation and 80/318 per binary.

The reference-rich reviewed fixture density was not used for projection. These
counts come from executing unchanged `labelled-reference-v5` over every
eligible representation in memory.

## Reproduction

Two complete executions produced 16,465 predictions and the same deterministic
payload SHA-256:

`9803e4fce557c815754f408a28f523653960eb783c63674d0c5860ed5abe94c0`

The database snapshot timestamps intentionally differ and are outside that
deterministic fingerprint. The full first-run inventory is retained as
`inventory-v1.json`.

## Interpretation and boundary

The measured volume is operationally manageable but is not yet approved for
writing. The concentration of attachment and generic labelled-reference role
hints makes the sampled pre-ingestion audit material: 8,394 attachment, 5,033
generic labelled, 1,781 cited, 1,198 folio, 48 coordinated, and 11
external-register observations. Family counts remain a separate extractor
field; older patterns that do not emit one remain explicitly `unclassified`
rather than inheriting a role hint silently. The extractor-level family totals
are 8,394 local attachment, 1,198 physical folio, 11 external register, and
6,862 unclassified.

Explicit write ceilings remain pending. No corpus observation, lifecycle
event, progress manifest, target candidate, relationship, or review record was
written. The next checkpoint is independent review of this inventory and a
frozen sampled pre-ingestion audit; only its evidence may justify later write
ceilings.
