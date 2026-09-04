# Labelled-reference-v5 corpus audit and ceiling gate

Status: frozen selection and acceptance contract pending human audit. This
checkpoint does not authorize corpus ingestion or database writes.

The only authorized inventory input is
`docs/evaluation/reference-v5-corpus-rollout/inventory-v1.json` with
deterministic payload SHA-256
`9803e4fce557c815754f408a28f523653960eb783c63674d0c5860ed5abe94c0`.
Its exact file SHA-256 is
`fb392df0ee449f4e90f034c00640f589545d18d06ad7d6cccd541d2d2c8d99e0`.
The builder verifies both values; any difference stops the workflow.

The deterministic audit manifest is
`docs/evaluation/reference-v5-corpus-rollout/audit-sample-v1.json`, with file
SHA-256 `90f275468ff38771e9ffbb5f9f87cbda7414f0d2040dba290e368b3ad61d5d0b`.
It freezes:

- 180 predicted observations selected with seed
  `labelled-reference-v5-corpus-audit-v1`;
- quotas across every processor, extractor family, extractor rule, the largest
  representations, fixture overlap, and binaries linked to several
  procedural occurrences;
- all explicit external-register predictions;
- 30 eligible no-prediction segments, ten per processor;
- all 50 frozen negative controls and three ambiguous diagnostics; and
- exact observation, representation, segment, hash, span, rule, label, parsed
  candidate, family, role, and selection-stratum provenance.

Overlapping strata select one observation with all applicable membership tags.
Seeded filling stops at exactly 180; the sample cannot grow after review starts.
The no-prediction controls are independent segment-level checks and do not
assert document-wide absence.

## Human audit decisions

An attributable reviewer must inspect the exact source context for every
sampled prediction and decide whether it is an in-scope reference under the
frozen v5 taxonomy. The reviewer must separately verify raw span, label span,
processor and representation identity, parsed candidate, rule attribution,
and absence of inferred targets or relationships. The 30 no-prediction
segments are reviewed for missed surface forms supported by v5; broader or
not-evaluated families remain outside scope.

Acceptance requires:

- at most three false-positive predictions and a false-positive rate no higher
  than 2%;
- zero provenance errors;
- zero extractor overlaps with the 50 protected negatives;
- no scoring of the three ambiguous controls; and
- zero confirmed missed in-scope v5 forms in the no-prediction controls.

Both the rate and count limits apply. Any systematic error, even within the
numeric allowance, blocks ingestion and returns to a versioned extractor or
sampling decision. Human review does not resolve targets or modify evidence.

## Hard operational ceilings

Later write planning must stop before mutation if it would exceed any measured
v1 ceiling:

- 16,465 predicted observations;
- 16,354 new inserts;
- 33 batches;
- 500 observations per batch;
- 15,851,473 serialized prediction bytes;
- 332 observations in one representation;
- 964 observations across one binary;
- zero non-insert lifecycle mutations; and
- zero blocked, collision, or ownership cases.

These are strict ceilings tied to the exact inventory fingerprint, not targets
with tolerance. Database storage overhead, lock time, and transaction duration
remain unmeasured and require separate canary ceilings before corpus writes.

## Stop boundary

Stop on fingerprint drift, identity collision, fixture-provenance mismatch,
ownership failure, unexpected lifecycle change, provenance error, protected
negative match, or any exceeded ceiling. Do not reinterpret a stop as approval
to repair data, widen rules, discard a processor, or change the sample.

This checkpoint freezes selection and acceptance criteria only. Transactional
corpus ingestion requires completion and independent review of the human audit,
followed by a separate explicit user authorization.
