# Labelled-reference-v4 capped-expansion error analysis

Status: completed analysis; extractor unchanged

Date: 2026-09-04

## Boundary

This analysis explains the 93 misses in the frozen
`reference-extraction-expansion-text-v1` fixture. It does not modify or rerun a
changed extractor, enlarge the fixture, or combine this work with metadata,
graph, glossary, or structured-discovery experiments.

The unchanged `labelled-reference-v4` baseline produced no predictions because
its current rules cover explicitly labelled procedural references and two
narrow coordinated attachment constructions. It has no generally applicable
rules for the attachment, physical-folio, or external-register forms selected
by this expansion. The zero-prediction result therefore establishes missing
capabilities; it does not establish that deterministic extraction is
unsuitable or that precision is 100%.

## Misses by family

| Reviewed family | Positives | Exact | Missed | Main cause |
|---|---:|---:|---:|---|
| Local attachment | 28 | 0 | 28 | No direct `Anexo`, `DOC`, or French `Nmr pièce` rule |
| Physical folio | 63 | 0 | 63 | No `fls` rule |
| External register | 1 | 0 | 1 | No `Registo:` rule |
| External police register | 1 | 0 | 1 | No `Registo n.°` rule |
| **Total** | **93** | **0** | **93** | Applicable deterministic rules absent |

French RG, Portalis, pourvoi, Portuguese and French ECLI, and EU case
identifiers have no reviewed examples in this frozen fixture and remain
`not_evaluated`.

## Local attachments

The 28 positives divide into these evidence groups:

- `Anexo nº <number>`: 3;
- `DOC Nº<number>`: 20;
- `DOC Nº <number>`: 3;
- compact `DOCNº<number>`: 1; and
- the numeric value `4` directly governed by the damaged French table label
  `Nmr piéce ·`: 1.

Twenty-five occur in literal PDF text, two in Xberg output, and one in Docling
output. Examples include `Anexo nº 13`, `DOC Nº12`, `DOC Nº 36`, `DOCNº19`,
and the French table value.

Three narrow deterministic forms are justified for a later versioned
extractor proposal:

1. a direct Portuguese `Anexo` label plus `n.º` variant and attachment number;
2. a direct `DOC` label accepting the reviewed compact and spaced `Nº` forms;
3. a tightly anchored French `Nmr pi[eèé]ce` table label plus separator and
   numeric value, with explicit inherited-label provenance.

The Portuguese rules should emit the complete labelled raw span and parse the
number separately. The French rule should emit only the reviewed numeric span
while retaining the exact label anchor. Hyphens between `Anexo` and `DOC`
references remain source-stated association context and must not imply
equivalence, containment, a parent filing, target identity, document identity,
or binary identity.

General `documento`, `pièce`, bare-number, or generic coordination matching is
not justified by this fixture.

## Physical folios

The 63 positives comprise:

- 60 independently labelled endpoints in 30 `fls … a fls …` intervals; and
- 3 standalone folio references.

Surface forms are:

- `fls. <number>`: 49;
- `fls.<number>`: 9; and
- `fls <number>`: 5.

Every interval endpoint repeats its own `fls` label, so no inherited-label rule
is needed. A later extractor can use one narrow, case-insensitive direct rule
for `fls`, an optional period, optional spacing, and a bounded digit value. It
must emit each endpoint separately, preserve the exact raw span, parse only the
digits, and retain unresolved target/document/binary fields.

The connecting `a` may be retained as source-stated interval association
provenance. It must not cause the extractor to synthesize a new range entity.
This fixture does not justify singular `fl.`, unlabeled continuation values,
alphanumeric suffixes, or pagination-like forms.

## External registers and damaged table

Two explicit Portuguese forms are reviewed positives:

- `Registo: 702380056723040`;
- `Registo n.° 1684/2020`.

Each supports a separate tightly labelled deterministic form that preserves
the whole raw span and parses the identifier without resolving its target. The
second passage provides police context, but a general rule must not infer a
police namespace solely from the spelling of the identifier.

The damaged French table also contains three ambiguous values: `01663`, a
standalone `1`, and `14429`. Their column relationships cannot be reconstructed
from flattened text. They remain explicit unsupported gaps pending original
page inspection and must not generate positive predictions. Only the `4`
directly associated with `Nmr piéce ·` supports a narrow rule.

The two Portuguese register examples provide evidence for their exact surface
forms only. Broader uses of the word `registo`, other authorities, and other
register syntaxes remain unsupported.

## Protected negatives

All 35 protected negatives had zero overlapping predictions in the unchanged
baseline:

| Negative kind | Count |
|---|---:|
| Sheet count (`1 folha`/`1 folh`) | 21 |
| Layout/page indicator | 2 |
| Year or date | 2 |
| Chemical/analyte designation | 2 |
| Structural list number | 2 |
| Pagination indicator | 1 |
| Organizational unit | 1 |
| Measurement | 1 |
| Assessment name | 1 |
| Version designation | 1 |
| Out-of-scope internal cross-reference | 1 |

Later rules must continue to reject bare years and numbers, `1 folha`,
`1 folh`, `2/129`, `Nº feuillet 1 / 1`, chemical and assessment names,
measurements, list/version numbers, `69.* Esq.*`, and
`ponto III. deste requerimento`.

The main safeguards are explicit lexical labels and exact span boundaries:
attachment rules require `DOC`, `Anexo`, or the tightly bounded French table
label; folio rules require `fls`; register rules require the reviewed `Registo`
punctuation or number marker. No rule should match an unlabelled number.

## Deterministic eligibility and next checkpoint

The evidence supports a versioned deterministic proposal because the misses
are dominated by repeated, high-structure forms:

- one direct `fls` family could address 63 positives;
- direct `DOC` and `Anexo` forms could address 27 positives;
- one tightly anchored French table form could address 1 positive; and
- two explicit `Registo` forms could address 2 positives.

This is an estimate, not a claimed result. The next checkpoint should document
the exact rule contracts, rule keys, label and coordination provenance, span
semantics, negative guards, and acceptance tests for a new extractor version.
Only after that proposal is reviewed should implementation rerun the frozen
fixture and the existing foundation regression fixture.

AI is not eligible from this baseline. The observed failures do not require
discourse reasoning or external knowledge, and no bounded deterministic
refinement has yet been attempted.
