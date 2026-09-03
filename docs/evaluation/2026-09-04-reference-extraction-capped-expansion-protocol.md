# Capped legal-reference evaluation expansion protocol

Status: frozen selection and evaluation protocol; no examples collected

Protocol version: `reference-expansion-v1`

Date: 2026-09-04

## Purpose and authorization boundary

This protocol freezes the next representative expansion before candidate
searches or evaluation results are observed. It defines two independent tracks:
text-span extraction and metadata-observation preservation/retrieval.

This checkpoint does not authorize example collection, annotation, extractor
modification, ingestion, database writes, or AI evaluation. The existing
foundation fixture and its `labelled-reference-v3` and
`labelled-reference-v4` results remain immutable regression artifacts.

## Track A: text-span extraction

### Hard ceilings

The expansion may contain at most:

- 12 new exhaustive ranges;
- 12 new representations;
- 20,000 Unicode code points across the new ranges; and
- 240 positive, negative, and ambiguous candidate spans in total.

These are ceilings, not targets that permit widening a range or adding a family
after results are known. Existing foundation-fixture ranges and annotations do
not consume these new quotas.

### Positive-family quotas

| Primary family | Maximum positive spans |
|---|---:|
| French RG | 4 |
| French Portalis | 4 |
| French pourvoi | 4 |
| Portuguese ECLI | 4 |
| French ECLI | 4 |
| EU case identifiers | 4 |
| Local attachment, pièce, annexe, or bordereau | 6 |
| Physical folio references | 4 |
| External administrative, police, civil, commercial, or land registers | 6 |
| **Total** | **40** |

A span has exactly one primary quota family even when it has cross-cutting
properties. At least eight selected positives should be OCR-damaged,
line-wrapped, punctuation-damaged, or spacing-damaged when such candidates are
available; this is a cross-cutting stratum and does not increase the 40-span
positive ceiling.

If a family cannot be found by the frozen selection procedure, its quota stays
unfilled and the family is reported as `not_evaluated`. Unused places must not
be reassigned to another family. No more than two positive anchors may be
selected from one binary for one family. When available, a four-or-more quota
must span at least two binaries and two representations.

### Frozen candidate sources

Candidates may be enumerated only from existing immutable representations and
the existing read-only full-corpus text-search projection. Selection queries
and broad discovery expressions must be saved before their results are
inspected. They may cover only these source terms:

- RG: `n° RG`, `nº RG`, `numéro RG`;
- Portalis: `Portalis`;
- pourvoi: `pourvoi n°`, `pourvoi nº`, `pourvoi no`;
- ECLI: `ECLI:PT:` and `ECLI:FR:`;
- EU cases: `affaire C-`, `processo C-`, `affaire T-`, and `processo T-`;
- attachments: `Doc`, `Documento`, `Anexo`, `Annexe`, `Pièce`, and
  `Bordereau de pièces`;
- folios: `fls.`, `folhas`, `feuillet`, and `folios`;
- external registers: `Registo`, `Registro`, `Entry No.`, `registre`, `NOR`,
  `JORFTEXT`, `CELEX`, and `ELI`.

No synonym or query may be added after baseline results are seen. A future
protocol version may add terms, but it must create a new selection artifact and
must not rewrite version 1.

### Deterministic sampling

Every discovered candidate receives a stable selection identity composed of
representation ID, representation-content SHA-256, candidate start/end, raw
candidate text, and primary family. Within each family, order candidates by the
ascending SHA-256 of:

```text
virgilio-reference-expansion-v1<US>selection-identity
```

Apply the per-binary diversity rule, then take candidates in that order until
the family quota or a hard ceiling is reached. Record all rejected candidates
and their deterministic rejection reason. Human preference must not reorder or
replace candidates after extraction results are known.

### Exhaustive range construction

For each selected anchor, choose the smallest coherent source unit containing
it: a complete list item, paragraph, table row, or headed section. Boundaries
must be recorded as zero-based, half-open Unicode code-point offsets. A range
must not exceed 2,000 code points. Overlapping ranges in one representation are
merged only before annotation and only when the merged range stays within that
limit.

Within every frozen range, reviewers must decide every in-scope reference
observation, every ambiguous candidate, and every number or expression that
could plausibly confuse the extractor. Repetition, difficulty, or unresolved
target identity is not grounds for omission. Each annotation retains exact raw
span, offsets, bounded context, representation identity and content hash,
processor/version/configuration identity when available, producer/version,
confidence, and attributable review provenance.

## Track B: metadata observations

### Hard ceiling and strata

The metadata sample contains at most 24 stable source assertions:

| Stratum | Maximum assertions |
|---|---:|
| Reference associated with a binary reused in multiple procedural contexts | 8 |
| Reference whose source record has no available binary | 8 |
| Ordinary binary-linked reference control | 8 |
| **Total** | **24** |

An assertion belongs to one stratum only, using the priority order shown above.
If fewer than eight eligible assertions exist in a stratum, leave the remainder
unfilled. Do not substitute assertions from another stratum.

### Stable identity and selection

The sampling unit is the stable source assertion, not a text span, document, or
binary. Its identity must include source system, source field, stable source-row
or occurrence identity, process anchor where available, raw value, and
normalization version. Associated binaries and procedural contexts are expected
relationships and do not replace that identity.

Within each stratum, order eligible assertions by the ascending SHA-256 of:

```text
virgilio-reference-expansion-v1<US>metadata<US>source-assertion-key
```

Take the first eight or all available assertions. Preserve the complete ordered
candidate inventory and rejection reasons. Reuse and missing-file status must
come from source relationships; they must not be inferred from a text search.

## Frozen artifacts

Version 1 uses these paths:

- `docs/evaluation/reference-extraction-expansion-v1/manifest.json`
- `docs/evaluation/reference-extraction-expansion-v1/text-selection.json`
- `docs/evaluation/reference-extraction-expansion-v1/text-annotations.json`
- `docs/evaluation/reference-extraction-expansion-v1/annotation-guide.md`
- `docs/evaluation/reference-extraction-expansion-v1/labelled-reference-v4-baseline.json`
- `docs/evaluation/reference-extraction-expansion-v1/metadata-selection.json`
- `docs/evaluation/reference-extraction-expansion-v1/metadata-baseline.json`
- `docs/evaluation/reference-extraction-expansion-v1/evaluation-report.md`

The manifest must record protocol version, selection seed, creation tool and
version, every artifact SHA-256, every representation-content SHA-256, extractor
key/version/configuration identity, normalization version, and review-session
identities. Once the manifest is frozen, corrections require a new artifact
version with explicit lineage; version 1 files are not silently rewritten.

## Review requirements

Before freezing the manifest:

1. an annotation producer records every candidate and decision provenance;
2. an attributable human reviewer checks every span in every text range;
3. a case expert reviews classifications that depend on procedural, local,
   register, or jurisdiction-specific context;
4. unresolved questions remain structured and do not block referencehood when
   only namespace, transcription, or target resolution is uncertain; and
5. an independent validator checks hashes, offsets, raw-span reconstruction,
   candidate completeness, unique IDs, quotas, ceilings, and review-session
   membership.

No text range is `exhaustive` and no metadata sample is `frozen` until all
applicable checks pass.

## Separate metrics and acceptance criteria

### Text-span extraction

Report by primary family and cross-cutting stratum:

- exact, partial/overlapping, missed, and spurious predictions;
- exact-span precision and recall;
- classification and normalization accuracy where applicable;
- false positives by negative kind; and
- rule key and direct/inherited-label provenance for every prediction.

A family with no reviewed positive denominator is `not_evaluated`. The
measurement is acceptable only when all ranges are exhaustive, all predictions
and annotations reconstruct against verified content hashes, and all metrics
have explicit denominators. Method performance is acceptable for deterministic
promotion only when each evaluated high-structure family reaches at least 95%
exact-span precision and 95% exact-span recall, with zero reference predictions
on reviewed dates, identity numbers, tax numbers, telephone numbers, amounts,
and paragraph-number controls. Report lower results honestly; do not expand the
sample to improve them.

### Metadata preservation and retrieval

Report separately:

- exact raw-value preservation;
- stable source-assertion identity preservation;
- source field, row/occurrence, process, and directly anchored date retention;
- normalization changes and collisions;
- current/history lifecycle correctness;
- associated binary availability and SHA-256 identity;
- complete reused-binary procedural contexts;
- missing-file records retained without fabricated open actions; and
- exact lookup retrieval by raw and normalized value where applicable.

Acceptance requires 100% preservation of raw values and stable source anchors,
100% correct availability classification, all expected reused contexts, zero
fabricated binaries/actions, and deterministic retrieval/order for all sampled
assertions. These outcomes are never combined with span precision or recall.

## Anti-expansion and stopping rules

After `text-selection.json` and `metadata-selection.json` are frozen:

- do not add, replace, or remove examples in response to extractor results;
- do not move range boundaries except to correct a documented offset or source
  integrity error;
- do not reclassify a difficult error merely to improve a metric;
- report absent families as `not_evaluated`; and
- create a new protocol and fixture version for any later expansion.

Run unchanged `labelled-reference-v4` first. After error analysis, permit at most
two deterministic refinement rounds. Accept a refinement only when it fixes at
least one reviewed error in its stated family, introduces no regression in the
frozen foundation fixture, and creates no new protected-negative false
positive. Stop deterministic refinement for a residual error when two bounded
attempts fail, the required rule depends on discourse or external knowledge not
present in a bounded context, or the rule cannot be narrowed without harming a
reviewed negative.

AI evaluation becomes eligible only when all of the following hold:

- deterministic refinement has stopped under the preceding rule;
- at least three reviewed residual errors remain in one represented family;
- those errors occur across at least two binaries or representations;
- the task is contextual classification or candidate ranking rather than
  identifier invention, source repair, or automatic target resolution; and
- an AI output schema preserves exact input lineage, uncertainty, model/version,
  prompt/configuration identity, and reviewability.

Eligibility does not authorize AI use. A separate frozen AI evaluation plan and
acceptance gate are required.

## Next authorized action

After review and commit of this protocol, the next bounded action is creation of
selection inventories only. It does not include annotation, extractor changes,
ingestion, or AI evaluation.