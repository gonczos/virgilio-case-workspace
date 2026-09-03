# Reference observations and text-search pilot

Last updated: 2026-09-03

## Decision and scope

The first implementation slice develops two narrow capabilities together:

1. attributed observations of court-facing references; and
2. representation-level full-text search over existing text segments.

Stable binary, document, occurrence, representation, and segment identity is the
shared prerequisite. Resolving every reference, reconstructing every package, or
classifying document contents is not a prerequisite for indexing text.

This pilot deliberately excludes full-corpus rollout, UI/API work, inferred
relationships, component entities, semantic classification, summaries,
embeddings, and merged processor output.

## Identity and provenance contract

Search results retain the existing lineage:

`document_segment -> document_representation -> file_binary`

The full SHA-256 identifies the original binary. A result also exposes every
source document and procedural occurrence currently linked to that binary. A
reused binary therefore has one searchable representation but can retain several
procedural contexts.

Processor outputs remain independent. The index does not select a canonical text
representation and does not merge literal PDF text, Docling, or Xberg output.

## Reference observations

`casework.reference_observation` records where a value was observed separately
from what the value may identify. Its stable key includes the producer/version,
source anchors, location, label, and normalized value. Reingestion updates that
observation instead of creating an unintended duplicate.

An observation can be anchored to an occurrence/document source record, a
metadata row, a binary, a representation, or a segment. It preserves:

- exact value and label plus a normalized lookup value;
- producer and producer version;
- available page or character location and local context;
- optional namespace and role hints;
- optional target candidates rather than a forced target;
- confidence and review state; and
- additional provenance metadata.

Confidence applies to the recorded observation unless the target candidate
itself carries separately supported evidence. It must not be interpreted as a
claim that the namespace or target has been resolved.

Source-system occurrence references and source document keys are recorded as
source facts. Values supplied by the external Document Register remain
`metadata_row` assertions with `needs_review` when their meaning or target is not
established.

The labelled-reference extractor is intentionally conservative. It records only
explicitly labelled forms such as `REF` or `sob a ref.` from literal PDF text. It
does not treat every number as a reference.

## Text-search projection

PostgreSQL maintains a stored Portuguese `tsvector` on
`document_segment.text_content` with a GIN index. This is disposable derived
search state. The source segment and representation remain authoritative for
what was indexed.

The pilot search contract returns the exact segment and representation identity,
processor/version, full binary SHA-256, available segment location, every linked
source context, and matching reference observations attached at query time.
Changing a reference interpretation therefore does not require rebuilding text
chunks.

Existing corpus segments are currently document-level: their `page_no` is null.
Pilot results must consequently report an honest document-level location. The
schema can retain page locations later, but this slice does not manufacture them
or rerun processors.

## Frozen acceptance fixture

`test/fixtures/reference-index-pilot.json` freezes 15 distinct available PDFs
and two missing-binary source documents, below a hard ceiling of 25 PDFs. It
covers:

- a short November 2014 procedural chain;
- a cited despacho and the cota that cites it;
- reused binaries and multi-file occurrences;
- filing-sheet and register-reference mismatches;
- certification/package examples;
- an external-looking reference; and
- unavailable multimedia that must remain referenceable without a binary.

References outside the frozen fixture do not expand it automatically. They stay
unresolved or become candidates for a later review queue.

## Operating commands

Apply the incremental schema to an initialized local database:

```powershell
npm run db:migrate:reference-search
```

Seed or refresh the bounded fixture, perform exact reference lookup, and search
the fixture:

```powershell
npm run reference:index:pilot
npm run reference:lookup -- --value 105398957
npm run search:pilot -- --query "despacho 105398957"
```

The seed is transactional and idempotent. The pilot search is restricted to the
fixture SHA-256 values; it is not a full-corpus search endpoint.

## Known limitations

- Existing segments have no page mapping.
- Extracted labelled references are observations, not resolved identities.
- The database does not yet enforce cross-column consistency among every nullable
  provenance anchor; writers must use anchors from the same lineage.
- Search has no consultation API or UI in this slice.
- The fixture validates the contract but is not evidence of corpus-wide recall.
