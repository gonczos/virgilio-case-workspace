# Legal-reference foundation fixture annotation guide

Status: draft bounded foundation fixture pending attributable review. It is not
a gold set, an extractor contract, or evidence of full-corpus performance.

## Units and provenance

Each annotation describes one exact observation in one immutable processor
output. `char_start` is a zero-based inclusive Unicode code-point index and
`char_end` is an exclusive Unicode code-point index into the UTF-8-decoded
content returned by the recorded API representation and format. Consumers must
verify `representation_content_sha256` before applying offsets.

Every annotation explicitly inherits `annotation_provenance_defaults` unless it
overrides a field. Those defaults identify the producing task and annotation
version, record `produced_at` as null because no production event timestamp was captured, retain the initial file modification time only as observed filesystem metadata, mark confidence as
`provisional_unreviewed`, and define the bounded-context policy. Each annotation
stores a `bounded_context` half-open range that can be reconstructed from the
verified representation content.

Review provenance is independent. Every annotation currently inherits null
reviewer identity, review time, decision, and rationale. `pending_review` and
`case_expert_required` must not be presented as completed review. A later review
must record an attributable reviewer, timestamp, decision, and rationale before
an annotation can become reviewed.

The original raw span is immutable. A normalized candidate is optional and
does not replace it. `resolved_target` remains null unless independent evidence
establishes the target. `document_level` means that no verified PDF-page claim
is available.

Processor identity and version are retained. Processor configuration identity
is mandatory when the source exposes it. The read-only consultation API did not
expose a processor profile or configuration hash for this snapshot, so
`processor_configuration_identity` is null, the available request/job value is
stored separately as `processing_request_identity`, and
`configuration_limitation` records the gap. The representation-content SHA-256
protects span reproducibility, but exact processor regeneration cannot be
claimed until configuration identity is available.

Processor agreement is not stored on an observation. Comparisons between
Docling, Xberg, and literal text are separately derived records.

## Review scope and completeness

Each representation declares `review_scope` as selected bounded context windows
around the recorded annotations. The scope is explicitly `non_exhaustive`: the
complete representation and the selected windows were not exhaustively reviewed
for every positive, negative, and ambiguous observation. An unannotated span
therefore means only that it is absent from this draft annotation set; it does
not establish that no reference exists there.

Recall, zero-false-positive rates, absence claims, and other completeness-based
metrics are prohibited for this fixture. They become valid only after the
relevant representation or precisely declared ranges are exhaustively reviewed
and all applicable positive, negative, and ambiguous observations within that
scope are annotated. Precision may be reported only with its reviewed
prediction denominator and without implying recall.

## Labels

* `court_process`: a labelled judicial proceeding identifier.
* `court_occurrence_or_citius_reference`: a labelled Citius/procedural value
  whose narrower target kind may remain unresolved.
* `local_attachment`: a filing- or bundle-scoped document reference.
* `legislation`: a statute, regulation, code, or provision reference.
* `international_instrument`: a named treaty or convention.
* `external_register`: a labelled non-court register or occurrence.
* `reference_like_negative`: a number that resembles a reference but identifies
  a person, address, telephone, fiscal document, or similar non-target.

## Annotation decisions

Use `positive`, `negative`, or `ambiguous`. Ambiguous observations remain valid
observations. `review_state` remains `pending_review` when an annotation has not
received attributable human review. `case_expert_required` identifies an
explicit question needing case knowledge and also does not imply completed
review.

Repeated textual occurrences remain separate. A later presentation layer may
deduplicate them without erasing observation provenance.

## Validation

Validation must confirm UTF-8 decoding, JSON syntax, unique annotation IDs,
representation hashes, half-open annotation and context range bounds, and exact
raw-span reconstruction under Unicode code-point indexing. Metrics are reported
per represented family only when the required review denominator and
completeness conditions exist. French, ECLI, missing-media, and other absent
families are `not_evaluated` in this foundation fixture.
