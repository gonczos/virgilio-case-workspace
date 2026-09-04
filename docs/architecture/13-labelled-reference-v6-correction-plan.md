# Labelled-reference-v6 bounded correction plan

Status: documentation-only correction contract. Implementation, corpus
extraction, ingestion, and database writes are not authorized.

## Inputs and immutability

The correction is based only on:

- frozen audit sample SHA-256
  `90f275468ff38771e9ffbb5f9f87cbda7414f0d2040dba290e368b3ad61d5d0b`;
- completed human audit commit `cd13d5a`;
- 15 rejected predictions;
- four separately recorded recall findings; and
- 30 passed no-prediction controls.

`labelled-reference-v5`, its fixtures, inventory, sample, review, and historical
evaluation artifacts remain immutable. A later implementation introduces
extractor version `labelled-reference-v6` and new rule identities. It must not
rewrite v5 results.

## Authorized rule changes

### 1. Digit-bearing generic labelled values

Replace the v5 generic rule with versioned rule
`reference-labelled-v4`. A captured value must contain at least one decimal
digit. The rule may retain the currently supported ASCII letters, digits,
period, slash, underscore, and hyphen around that digit.

The same rule must not cross an empty reference field into a later labelled
field. Newline tolerance is allowed only when the candidate begins immediately
after the reference label's separator and satisfies the digit-bearing value
grammar. This rejects the reviewed `deste`, `sequer`, and `Requerente` cases.

This constraint is justified only for currently evaluated generic references.
Alphabetic-only references remain not evaluated.

### 2. Citius as a namespace qualifier

Add versioned rule `reference-citius-qualified-v1` for the reviewed forms where
`Citius` occurs between a generic `Ref` label and the numeric identifier, such
as:

```text
Refº Citius: 8656497
Refº Citius: 651161
```

The emitted value is the first directly following digit-bearing identifier.
The raw label and label provenance include the `Citius` qualifier. `Citius`
must never be emitted as the identifier. Later semicolon- or conjunction-linked
values are outside this rule unless another already-supported rule independently
matches them.

### 3. Complete `A` attachment suffixes

Replace `local-attachment-doc-v1` with
`local-attachment-doc-v2`. In addition to existing immediate suffixes, it may
include exactly the reviewed separated `A` forms:

- whitespace followed by `A`;
- hyphen followed by `A`; and
- optional whitespace around that hyphen.

The raw span preserves its exact spacing and punctuation. The parsed attachment
candidate removes only the separating whitespace/hyphen needed to represent
the source-stated suffix. The rule must not treat the Portuguese conjunction
`e` or a following prose word as a suffix. Broader suffix alphabets require
separate evidence.

### 4. Folio continuations

Add two versioned rules:

- `physical-folio-coordination-v1` for a second folio after `e`, covering the
  reviewed `26v.` and `838` forms; and
- `physical-folio-compact-range-v1` for a second folio after `/`, covering the
  reviewed `1103` form.

Both require a directly preceding valid `fls` observation in the same local
construction. Each emits only the second endpoint as its own observation and
records inherited-label provenance, the coordination/range cue, and the
preceding value. `26v.` preserves the raw verso marker and punctuation; parsed
folio number and side are separate fields.

### 5. Attachment range continuation

Add `local-attachment-range-v1` for the reviewed construction
`Doc nº1 a 7`. It emits `7` as a separate attachment observation with inherited
label provenance, range cue `a`, and preceding value `1`. It does not merge the
endpoints or resolve a parent, target, document, or binary.

## Explicit exclusions

The v6 correction does not add or infer:

- process-number extraction;
- French RG, Portalis, pourvoi, ECLI, administrative, approval, or organizer
  identifiers;
- payment, guide, receipt, or correspondence identifier families;
- recovery of labels lost through page-layout flattening;
- punctuation repair for `38477843-`;
- digit correction for `1606407299`;
- general list parsing beyond the reviewed forms;
- target resolution, relationship resolution, document identity, binary
  identity, or preferred representation; or
- AI classification or AI-generated normalization.

## Required evaluation artifact

Before implementation results are accepted, create a versioned v6 evaluation
oracle derived from the completed audit. It must identify:

- the 163 already confirmed v5 predictions that remain expected;
- replacements for all three truncated attachment predictions;
- replacement numeric observations for all four namespace-only `Citius`
  predictions;
- removal of seven ordinary-language predictions and the one empty-field party
  label;
- the four new continuation/range observations; and
- the two PDF-dependent predictions as unscored diagnostics with their raw
  values unchanged.

Every changed or added expected observation must include exact representation
and segment identity, hashes, zero-based half-open Unicode code-point offsets,
raw span, parsed candidate, rule identity, and direct or inherited label
provenance. Generation must be deterministic and must not query or write the
database when the frozen source evidence is already available.

## Acceptance gate

A later implementation checkpoint must run v6 against the exact frozen source
representations and demonstrate:

- all 15 reviewed v5 rejection causes are absent;
- all three corrected attachment spans match exactly;
- all four qualified-Citius observations emit the numeric value rather than
  `Citius`;
- all four recall findings are recovered at exact spans;
- all 163 previously confirmed predictions remain correct, accounting for any
  deliberately versioned rule identity;
- both PDF-dependent predictions remain unscored and byte-for-span unchanged;
- zero predictions overlap the 50 protected negatives;
- all three protected ambiguous spans remain unscored;
- all 30 no-prediction controls still contain zero supported-v6 predictions,
  except an explicitly expected correction already frozen in the v6 oracle;
- the original foundation and capped-expansion fixtures retain their existing
  exact results; and
- deterministic reruns produce byte-identical evaluation output.

Precision for decided predictions excludes the two PDF-dependent cases. The
implementation target is zero rejected predictions among the corrected frozen
sample, but this remains bounded evaluation evidence and not a corpus-wide
precision or recall claim.

## Next checkpoint

The next action is to independently review and commit this documentation-only
contract. After that, implementation may create the v6 evaluator/oracle and
extractor changes as one bounded checkpoint. It must stop after evaluation and
must not run corpus-wide extraction, refresh the v5 inventory, ingest
observations, or authorize writes.
