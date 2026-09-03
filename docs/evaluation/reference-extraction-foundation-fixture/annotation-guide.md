# Legal-reference foundation fixture annotation guide

Status: draft bounded foundation fixture with one attributable, exhaustively
reviewed range. It is not evidence of full-corpus performance.

## Units and provenance

Each annotation describes one exact observation in one immutable processor
output. `char_start` is a zero-based inclusive Unicode code-point index and
`char_end` is an exclusive Unicode code-point index into the UTF-8-decoded
content returned by the recorded API representation and format. Consumers must
verify `representation_content_sha256` before applying offsets.

Every annotation explicitly inherits `annotation_provenance_defaults` unless it
overrides a field. Those defaults identify the producing task and annotation
version, record `produced_at` as null because no production event timestamp was
captured, retain the initial file modification time only as observed filesystem
metadata, mark confidence as `provisional_unreviewed`, and define the bounded-
context policy. Each annotation stores a `bounded_context` half-open range that
can be reconstructed from the verified representation content.

Review provenance is independent. Every annotation initially inherits null
reviewer identity, review time, decision, and rationale. `pending_review` and
`case_expert_required` must not be presented as completed review. A completed
review must record an attributable reviewer, timestamp, decision, and rationale.

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

Each representation declares its review scope. The complete representations
remain non-exhaustive, and selected context windows outside a declared
exhaustive range do not support absence or recall claims. Representation 6038
contains one exhaustively reviewed half-open range, `[6822, 8619)`, covering the
complete chronological entries a) through n). Every positive reference,
plausibly confusable negative, and ambiguous candidate under the recorded
candidate definition in that range has an attributable decision.

Recall, false-positive rates, and absence claims are prohibited outside an
exhaustive range. They may be reported for `[6822, 8619)` only when predictions
are evaluated against that exact range and its recorded candidate definition.
No metric from this range may be presented as representation-wide,
document-wide, family-wide, or corpus-wide performance.

## Labels

* `court_process`: a labelled judicial proceeding identifier.
* `court_occurrence_or_citius_reference`: a labelled Citius/procedural value
  whose narrower target kind may remain unresolved.
* `local_attachment`: a filing- or bundle-scoped document reference.
* `legislation`: a statute, regulation, code, or provision reference.
* `international_instrument`: a named treaty or convention.
* `external_register`: a labelled non-court register or occurrence.
* `external_civil_register`: a labelled entry in an external civil register.
* `external_document_identifier`: a possible external official-document
  identifier whose narrower semantics remain ambiguous.
* `reference_like_negative`: a number that resembles a reference but identifies
  a person, address, telephone, fiscal document, or similar non-target.

## Annotation decisions

Use `positive`, `negative`, or `ambiguous`. Ambiguous observations remain valid
observations. `review_state` remains `pending_review` when an annotation has not
received attributable human review. `case_expert_required` identifies an
explicit question needing case knowledge and also does not imply completed
review.

Completed reviews are recorded in `review_sessions`, and each reviewed
annotation contains a `human_review` object that names its session, reviewer,
review time, decision, rationale, structured findings, `review_question_status`,
and `remaining_verification`. Question status is `answered`,
`partially_answered`, `unanswered`, or `not_applicable` when the annotation had
no retained review question. It describes resolution of the retained
`review_question` independently from the fact that a human review occurred. A
completed review may confirm a broad classification while leaving namespace,
transcription, target, relationship, document, or binary identity unresolved.
Such unresolved fields do not invalidate the review decision and must not be
silently promoted. When a later exhaustive review refines an earlier decision,
the superseded decision remains attributable in `review_history`.

General review rules established by the guided sessions are:

* keep explicit source assertions separate from contextual inference;
* keep classification confidence separate from transcription confidence;
* do not equate procedural occurrences, target records, documents, and binaries;
* store source-stated relations as candidates until independently resolved;
* parse defensible structure without repairing the raw source;
* attach a reference first to the grammatically described occurrence; and
* preserve authority, organizational unit, source namespace expression, and
  identifier as separate evidence fields.

Negative means that a span does not represent a reference in an in-scope
reference family; it does not merely mean that the span is not a Citius or court
reference. Identity, tax, and telephone identifiers can remain useful to other
entity extractors without becoming legal-reference observations.

Repeated textual occurrences remain separate. A later presentation layer may
deduplicate them without erasing observation provenance.

## Exhaustive range decisions

The exhaustive range in representation 6038 contains 33 independently
measurable spans: 16 procedural-reference positives, two local-attachment
positives, and 15 date negatives. Namespace certainty, transcription quality,
target resolution, document identity, and binary identity do not determine
reference-observation polarity.

The repeated value `131089062` is therefore represented by two positive spans.
The coordinated expression `Doc nº Doc 25 e 25 A` is represented by the atomic
positive spans `Doc nº Doc 25` and `25 A`; the full expression remains available
through bounded context. The unusual date form `15-072020` remains an exact raw
negative span and is not repaired.

## Validation

Validation must confirm UTF-8 decoding, JSON syntax, unique annotation IDs,
representation hashes, half-open annotation and context range bounds, and exact
raw-span reconstruction under Unicode code-point indexing. Metrics are reported
per represented family only when the required review denominator and
completeness conditions exist. French, ECLI, missing-media, and other absent
families are `not_evaluated` in this foundation fixture.
