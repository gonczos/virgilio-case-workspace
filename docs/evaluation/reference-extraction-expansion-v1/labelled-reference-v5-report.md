# Labelled-reference-v5 capped-expansion evaluation

Date: 2026-09-04

## Change

`labelled-reference-v5` adds only the deterministic forms justified by the
frozen v4 error analysis:

- directly labelled physical folios using `fls`, with optional period and
  spacing;
- directly labelled Portuguese `DOC` and `Anexo` attachments;
- the two reviewed explicit Portuguese `Registo` forms; and
- the exact damaged French table construction `Nmr piéce · <number>`.

Every prediction preserves its exact raw span, parsed candidate, stable rule
key, and direct or inherited-label provenance. Targets, documents, and binary
identities remain unresolved. The French rule emits only the numeric span and
records the damaged label as inherited provenance. No generic bare-number,
document, piece, singular-folio, or register rule was added.

## Frozen expansion evaluation

Command:

```powershell
npm run reference:evaluate-expansion-text
```

Against the unchanged 12-range reviewed fixture, v5 produced 93 predictions:

| Family | Exact | Missed | Spurious | Exact precision | Exact recall |
|---|---:|---:|---:|---:|---:|
| Local attachment | 28/28 | 0 | 0 | 100% | 100% |
| Physical folio | 63/63 | 0 | 0 | 100% | 100% |
| External register | 1/1 | 0 | 0 | 100% | 100% |
| External police register | 1/1 | 0 | 0 | 100% | 100% |
| **Overall** | **93/93** | **0** | **0** | **100%** | **100%** |

All 35 protected negatives had zero overlapping predictions. The three
ambiguous damaged-table values (`01663`, `1`, and `14429`) are retained as
unscored diagnostics and received no predictions.

Rule attribution was complete:

- `physical-folio-fls-v1`: 63;
- `local-attachment-doc-v1`: 24;
- `local-attachment-anexo-v1`: 3;
- `local-attachment-french-damaged-piece-v1`: 1;
- `external-register-colon-v1`: 1; and
- `external-register-numbered-v1`: 1.

French RG, Portalis, pourvoi, Portuguese and French ECLI, and EU case
identifiers remain `not_evaluated` because the frozen fixture contains no
reviewed denominator for them.

Machine-readable results are stored in
`labelled-reference-v5-evaluation.json`. The historical v4 baseline remains
unchanged.

## Foundation regression

Command:

```powershell
npm run reference:evaluate-foundation
```

The original exhaustive foundation scope remains at 18/18 exact predictions:
16 procedural references and two attachments. There are no partial, missed,
spurious, or date-negative overlaps. Results are stored separately in
`../reference-extraction-foundation-deterministic-v5.json`; the immutable v4
artifact was not rewritten.

## Boundary

These results apply only to the frozen reviewed ranges and surface forms. They
do not establish performance for absent families or authorize corpus-wide
ingestion. No AI, database write, API, UI, graph, glossary, or structured
discovery work was performed.
