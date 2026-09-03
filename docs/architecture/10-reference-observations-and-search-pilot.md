# Reference observations and text-search pilot

Last updated: 2026-09-03

## Decision and scope

The first implementation slice develops two narrow capabilities together:

1. attributed observations of court-facing references; and
2. representation-level full-text search over existing text segments.

Stable binary, document, occurrence, representation, and segment identity is the
shared prerequisite. Resolving every reference, reconstructing every package, or
classifying document contents is not a prerequisite for indexing text.

This pilot deliberately excludes full-corpus rollout, UI work, inferred
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
source context, and reference observations attached at query time.
Changing a reference interpretation therefore does not require rebuilding text
chunks.

Search responses must separate two scopes:

- `passage_reference_observations` contains only observations anchored to the
  matching segment; and
- `contextual_reference_observations` contains observations elsewhere on the
  same binary or in its source context.

An observation shown beside a Docling or Xberg hit must not appear to have been
produced by that processor merely because it was found on the same binary. Every
returned observation retains its own occurrence/document, representation,
segment, observer/version, processor/version, and location anchors. The scope
name describes its relationship to the search hit; it does not change its
provenance.

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

## Read-only consultation API

The consultation service exposes the bounded pilot through two GET endpoints:

```text
/api/consultation/reference-pilot/references/<exact-value>
/api/consultation/reference-pilot/search?q=<terms>&limit=<1-100>
```

Exact lookup is restricted to observations attributed to the named fixture,
including source records whose binaries are unavailable. Text search is
restricted to the fixture's 15 SHA-256 values.

API reference items keep the observed value and provenance under `observation`.
Any reviewed target decision is returned separately under `target_resolution`;
an observation is never itself presented as a resolved target. Extractor records
also state whether they are current, older, or an older record retained because
it has a review.

Each exact-lookup item also retains the full binary SHA-256 when a binary exists
and every linked source-document and procedural-occurrence context returned by
the database. These contexts are not collapsed to the occurrence on which the
observation was recorded: a client must be able to see reuse and navigate
directly to `/api/consultation/binaries/<sha256>`. A missing binary is represented
by a null binary identity rather than by dropping its source-record context.

Search hits expose `passage_reference_observations` and
`contextual_reference_observations` separately. Locations use one of three
explicit states: `document_level`, `processor_page_unverified`, or
`verified_pdf_page`. A numeric processor page is not promoted to a verified PDF
page without explicit verification metadata.

Observation locations additionally distinguish their evidence channel.
`document_level` is reserved for observations made in document content without
a page mapping. Source-system fields use `source_record`; external register or
other metadata assertions use `metadata_record`; an observation anchored only to
a binary uses `binary_level`. Metadata-only observations must never be presented
as locations within document content.

## Fixture-scoped consultation UI slice

The next consultation slice is a small read-only surface over the existing pilot
API. The fixture boundary must remain visible throughout the interface. This
slice does not add classification editing, reference resolution, curation, or
full-corpus retrieval.

The search control uses one input with an explicit mode selected by the user:
`Exact reference` or `Text`. The application must not infer the mode from the
shape of a number or query.

Exact-reference results lead with human-facing source document and occurrence
context. Observed values remain separate from reviewed target resolutions.
Missing-file source records remain visible and must not be described as missing
documents or failed searches.

An empty result is mode-specific: `No reference-observation matches within the
pilot` or `No text-search matches within the pilot`. It must never say `Document
not found`, because retrieval coverage and document presence are separate facts.

Text results are grouped by full binary SHA-256. Processor-specific hits are
expandable beneath that binary so independent extractions are not presented as
separate documents. Grouping must not hide the source document and occurrence
context attached to each reference observation. Document name, recorded date,
process, and occurrence reference are primary; full hashes and extraction
provenance remain available in expandable technical details.

The acceptance gate consists of five user tasks:

1. find a known exact reference;
2. follow a citation without treating it as a resolved target;
3. distinguish the occurrences of a reused binary;
4. inspect a missing-file source record; and
5. open the original binary from a text-search hit.

Success requires completing these tasks without mistaking an observed reference
for a resolved target or a document-level location for a verified PDF page.

Read-only global coverage measurements may run alongside UI implementation. They
must report text-search coverage and reference-lookup coverage separately. The
stored text-search projection already spans the existing segment table, whereas
reference observations are currently fixture-scoped. A failed reference lookup
therefore must not imply that the document or searchable text is absent. These
measurements inform a later scope-widening decision; they do not block this UI
slice and do not themselves authorize wider retrieval.

## Review ownership and reseeding

Ingestion and human review have different ownership. Routine ingestion may
refresh observation-owned facts such as the exact value, source anchors,
extractor context, and ingestion hints. It must not reset a human decision about
namespace, role, target candidates, confidence, review state, or reviewer notes.

Human decisions are therefore stored in a separate one-to-one
`reference_observation_review` record. Consultation reads the review as an
overlay while retaining the original observation. This also makes the reviewer,
review timestamp, and notes independently attributable.

When an extractor version is superseded, unreviewed observations from the older
version may be removed from the bounded fixture. An observation with a review
must be retained; the new extractor output is recorded separately under its new
stable observation identity. Reconciliation between those observations is a
later review action, not an ingestion-side overwrite.

## Known limitations

- Existing segments have no page mapping.
- Extracted labelled references are observations, not resolved identities.
- The database does not yet enforce cross-column consistency among every nullable
  provenance anchor; writers must use anchors from the same lineage.
- The consultation UI is intentionally fixture-scoped.
- The fixture validates the contract but is not evidence of corpus-wide recall.
