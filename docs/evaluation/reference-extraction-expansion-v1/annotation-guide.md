# Reviewed text fixture v1

This directory separates selection, text-span review, and metadata review. `text-selection.json` remains the frozen, unannotated selection artifact. `text-reviewed-fixture-v1.json` records the attributable guided review of every candidate and plausible confusable span in its 12 exact ranges. `metadata-selection.json` is untouched and remains a separate subsequent review track.

## Scope and status

The reviewed text fixture contains 131 non-overlapping observations: 93 positive references, 35 negative or out-of-scope confusable spans, and three ambiguous spans. Each range is exhaustive only under this candidate definition: every in-scope positive reference, plausible confusable negative, and genuinely ambiguous reference-like span inside the exact half-open Unicode code-point range.

Completeness does not extend outside the 12 ranges. Families with no selected examples remain `not_evaluated`. Internal-document section references are genuinely referential but remain out of scope for the frozen v1 protocol, so `ponto III.  deste requerimento` is recorded as an out-of-scope negative rather than adding a new positive family after selection.

All annotations were reviewed interactively by `case_support_reviewer_attila_test_1`. The exact review timestamp was not captured, so `reviewed_at` is null. No filesystem, commit, or conversation timestamp is substituted for that missing fact.

Raw spans and source spelling are immutable evidence from identified stored representations. Parsed candidates are interpretations and do not replace the raw text. Source-stated associations are retained without resolving targets, parent filings, documents, binaries, namespaces, or relationships. The three damaged-table candidates remain ambiguous pending original-PDF inspection.

## Files

- `text-selection.json`: frozen deterministic selection inventory.
- `text-reviewed-fixture-v1.json`: reviewed exhaustive span fixture.
- `metadata-selection.json`: frozen metadata candidate inventory; not reviewed or changed by this checkpoint.
- `../../app/build-reviewed-reference-expansion-text-fixture.mjs`: deterministic encoding of the confirmed guided decisions against live representation text.
- `../../app/validate-reference-expansion-text-fixture.mjs`: structural, provenance, content-hash, span, context, membership, non-overlap, and declared-completeness validation.

## Validation

Run:

```powershell
npm run reference:validate-expansion-text
```

The validator reads the frozen selection and reviewed fixture, then performs read-only HTTP GETs for the 11 represented stored representations. It verifies full representation hashes and range hashes, reconstructs all 131 spans and contexts using Unicode code-point offsets, checks non-overlap, checks the exact expected candidate count and completeness membership for every range, verifies review attribution and taxonomy boundaries, and confirms the required totals.

This mechanical validation cannot independently discover semantic candidates that a reviewer omitted. An independent reviewer inspected the complete text of every declared range and confirmed that its candidate inventory is exhaustive under the recorded definition. The attributable audit is stored in `independent_verification_sessions`, with an honestly null timestamp because the exact review time was not captured. The fixture is therefore `reviewed_frozen`. This verification did not run or modify `labelled-reference-v4`.
