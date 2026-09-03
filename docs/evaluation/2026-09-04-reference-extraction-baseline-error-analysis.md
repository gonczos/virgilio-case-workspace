# Deterministic reference-extraction baseline error analysis

Date: 2026-09-04

## Scope and constraint

This analysis explains the three misses recorded by the unchanged
`labelled-reference-v3` baseline. It does not change extractor behavior, tune a
production rule, or compare an AI system. Scored claims apply only to
representation 6038, Unicode code-point range `[6822, 8619)` and its frozen
33-span candidate definition.

## Failure class 1: coordinated procedural values

The extractor recognizes `122170551` in:

```text
referência citius: 122170551 e 122178618 respectivamente
```

It misses `122178618` because both current patterns require every value to be
immediately preceded by their own reference label. The source instead gives one
label to a coordinated sequence and confirms positional association with
`respectivamente`.

A diagnostic continuation rule was anchored to all of the following:

1. an existing supported reference label;
2. a first supported reference value;
3. the conjunction `e`;
4. a second reference-shaped value; and
5. the following word `respectivamente`.

That diagnostic rule recovered exactly `122178618` at `[7146, 7155)`. It did not
overlap any of the 15 reviewed date negatives.

This is a label-inheritance/coordination failure. A production change should
emit the second value as its own observation while retaining evidence that its
label was inherited from the coordinated construction. It must not merge the
two values or resolve either target.

## Failure class 2: local attachment references

The current extractor has no `Doc`/attachment family. It therefore misses both
atomic observations in:

```text
Doc nº Doc 25 e 25 A
```

Two diagnostic rules recovered:

- `Doc nº Doc 25` at `[7993, 8006)`; and
- `25 A` at `[8009, 8013)`.

The first rule required the observed duplicated `Doc nº Doc` construction. The
second required the complete anchored coordination before inheriting attachment
semantics for `25 A`. Neither diagnostic match overlapped a reviewed date
negative.

This combines a missing reference family with coordinated label inheritance.
A production design should preserve each atomic span, the full coordination as
context, the raw duplicated wording, and the parsed candidates `25` and `25A`.
It must not infer attachment targets, document identities, binary identities,
or silently repair the extracted wording.

## Diagnostic outcome

Applied only to the three baseline misses, the two diagnostic rule families
would change the frozen-range result as follows:

| Metric | Baseline | Diagnostic projection |
|---|---:|---:|
| Procedural exact matches | 15/16 | 16/16 |
| Attachment exact matches | 0/2 | 2/2 |
| Overall exact matches | 15/18 | 18/18 |
| Predictions overlapping 15 date negatives | 0 | 0 |

The diagnostic patterns were also probed, without scoring, over complete
representations 6038 and 4950. They produced only the same three matches. Since
those complete representations are not exhaustively annotated, this is merely
an overbreadth check and is not a precision or false-positive measurement.

## Recommended implementation boundary

A bounded deterministic change is justified before any AI comparison:

- add coordinated continuation handling for explicitly labelled procedural
  values, initially requiring the strong `respectivamente` cue;
- add local-attachment recognition for the reviewed `Doc` construction and its
  coordinated value;
- emit independent observations with exact offsets and inherited-label
  provenance;
- rerun the unchanged frozen evaluation and retain the original baseline for
  comparison;
- reject the change if any reviewed date negative becomes a prediction.

Broader conjunction handling, general attachment grammar, OCR repair, target
resolution, and corpus-wide claims remain outside this checkpoint. The fixture
is too narrow to justify AI assistance or a general Portuguese reference
extractor from these results alone.