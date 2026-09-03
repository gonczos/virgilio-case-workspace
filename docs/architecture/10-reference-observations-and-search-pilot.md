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

The UI renders a document-level reference observation as `Exact match found in
document. Page number cannot be determined.` A general text hit uses `Text found
in document. Page number cannot be determined.` These labels describe the match
location only; the containing binary remains known and available to open.

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

Displayed results retain the submitted mode and query independently of later
changes to the input controls. Their heading states either `Exact-reference
observations for ...` or `Text-search results for ...`; changing the selected
mode must not silently relabel results already on screen.

Exact-reference results lead with human-facing source document and occurrence
context. Observed values remain separate from reviewed target resolutions.
Missing-file source records remain visible and must not be described as missing
documents or failed searches.

Every reference observed in a text result offers `Find observations of this
reference`. This performs an exact observation lookup; it does not open or claim
to resolve the cited target. The containing-file action remains separate.

An empty result is mode-specific: `No reference-observation matches within the
pilot` or `No text-search matches within the pilot`. It must never say `Document
not found`, because retrieval coverage and document presence are separate facts.

Text results are grouped by full binary SHA-256. Processor-specific hits are
expandable beneath that binary so independent extractions are not presented as
separate documents. Grouping must not hide the source document and occurrence
context attached to each reference observation. Document name, recorded date,
process, and occurrence reference are primary; full hashes and extraction
provenance remain available in expandable technical details.
Technical observation details expose all stored binary, source-document,
occurrence, representation, segment, processor, observer, page, and character
anchors. Unavailable anchors are labelled as not recorded rather than omitted.

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

## Controlled full-corpus text-search experiment

The next approved planning direction is a controlled experiment, not an
automatic production rollout. Implementation must begin by fixing the current
overlapping-request race in the consultation UI: only the latest submitted
request may update results, errors, loading state, or the submitted-mode heading.
This prerequisite must have focused regression coverage.

Scope selection is mode-specific. `Exact reference` remains visibly pilot-only.
Only `Text` may offer `Pilot` and `Full corpus`; switching modes must not imply
that reference-observation coverage widened with text-search coverage.

Before widening the query, freeze an evaluation set of 10–15 searches. Each
entry records:

- query and query category;
- expected relevant PDF SHA-256 values where known;
- the factual basis for each expectation;
- whether useful content depends on OCR;
- the expected discovery and original-opening outcome; and
- an explicit unresolved expectation where no ground truth is available.

Query categories remain separate: keyword search, literal reference-number text
search, and quoted-text search test different behavior. Quotation marks must not
be described as guaranteeing exact phrase matching unless that behavior is
deliberately implemented and tested.

Every result set reports the configured passage cap, returned passage count,
distinct binary count, and whether the result was capped. Processor-specific
hits remain grouped beneath their binary because several representations of one
PDF can consume the passage limit. The evaluation includes scanned PDFs whose
useful content depends on OCR; nonblank-text counts alone are not evidence that
their content is retrievable.

The experiment has one decision question: can users reliably find known
material, understand why it matched, and open the correct original? If yes, the
broader text scope may be retained. If not, observed failures determine whether
the next bounded improvement concerns ranking, extraction coverage, page
navigation, or reference ingestion. The experiment must not assume in advance
that reference ingestion is the next phase.

Implementation status (2026-09-03): this bounded experiment is implemented.
The UI uses a latest-request-wins guard, exact-reference lookup remains
pilot-only, and Text search exposes explicit `Pilot` and `Full corpus` scopes.
The API reports passage limit, returned passage count, distinct binary count,
and truncation state. The frozen fixture is
`test/fixtures/full-corpus-text-search-evaluation.json`; it must not be tuned
after execution merely to improve the recorded pass rate.

The first recorded execution found all 3,706 stored segments indexed across all
1,238 binaries. Nine of ten predeclared known-target queries placed every
expected binary within the first ten distinct binaries. The broad keyword query
`Marianne intérprete` placed the expected Ata at rank 24, so the experiment did
not meet its complete acceptance gate. Both OCR-dependent scanned-document
families were retrievable. This supports retaining full-corpus Text search as an
explicit experimental scope while treating ranking as the next bounded search
problem; it does not widen reference-observation coverage.

### Completed follow-up correction

The follow-up made two bounded corrections:

- describe exact-reference coverage as `pilot reference observations`, not
  `reviewed pilot observations`; inclusion in the fixture does not establish a
  completed human review;
- run the unchanged frozen query fixture at the UI's 50-passage limit as well
  as the evaluator's original 100-passage limit, and report the two
  configurations separately.

The 100-passage result remains a valid recorded experiment, but is not presented
as the UI-equivalent score. The unchanged fixture was rerun through the same
evaluator with an explicit 50-passage override. Both configurations scored
9/10, and the same `Marianne intérprete` query remained the sole failure at
distinct-binary rank 24. At 50 passages that result was capped, making the UI's
truncation warning material even though the expected binary remained present.
Expected binaries, rank thresholds, query text, and exploratory/counting status
were not changed.

### Planned passage-pagination slice

The next approved implementation slice is `Load more` for Text search. It comes
before ranking experiments because the current UI can identify truncation but
cannot retrieve passages after its first 50-row page. Raising the limit would
only move that boundary.

The bounded implementation uses passage-based pagination. Distinct-PDF
pagination is deferred because it first requires a deliberate document-ranking
contract and a consistent way to retrieve all processor passages for each
ranked binary. Passage pagination preserves the current relevance semantics and
must satisfy this contract:

- the API accepts an offset and continues to order by rank descending and
  segment ID ascending, so tied ranks have a deterministic order;
- API counts and pagination metadata describe only the returned server page,
  including its requested offset, number of rows returned, and whether another
  page is available;
- the UI keeps an immutable submitted-search identity containing the query and
  scope that produced the displayed results; editing the controls does not
  change what `Load more` continues;
- every newly submitted search starts at server offset zero and replaces the
  accumulated result set; only `Load more` appends and advances the offset;
- the next offset advances by server rows returned before client-side
  deduplication, preventing a repeated segment from stalling pagination;
- accumulated passages are deduplicated by segment ID, appended without
  discarding earlier results, and regrouped by full binary SHA-256 so later
  processor hits extend an existing PDF group;
- accumulated UI counts separately report loaded passages and distinct PDFs;
- `Load more` is disabled while its request is pending and disappears or becomes
  unavailable when the server reports no later page;
- a page failure preserves loaded results and the previous offset so the user
  can retry; and
- starting a new search invalidates any older initial or page request, so stale
  responses cannot alter the new search.

Acceptance coverage must retrieve beyond the initial 50 rows, merge a later
processor passage into an existing binary group, calculate accumulated counts,
reach the final page, retry after a failed page without data loss, and ignore an
old page response after a new search begins.

Offset pagination assumes the searchable projection remains unchanged during a
browsing session. Deterministic tie-breaking does not prevent concurrent
reindexing from shifting page boundaries. That limitation is accepted for this
experiment and must be visible in its documentation; snapshot or cursor
pagination is outside this slice.

Implementation status (2026-09-03): this passage-pagination slice is complete.
The API returns page-local offset and continuation metadata, and the UI reports
deduplicated accumulated passage/PDF counts while regrouping later hits under
their SHA-256 binary. Live validation loaded the `Marianne intérprete` search
from 50 passages/25 PDFs to its final 80 passages/30 PDFs; 11 binaries had hits
on both server pages. A separate retry check preserved 100 loaded passages when
the API was unavailable and advanced to 150 after the same page was retried.
Editing the input before loading more continued the immutable submitted query.

### Planned binary ordering slice

Text search will add an explicit binary-group ordering selector with these
options:

- `Relevance` (`relevance`) — default;
- `Earliest occurrence` (`earliest_occurrence_asc`) — position each binary by
  its earliest recorded procedural occurrence, oldest first; and
- `Latest occurrence` (`latest_occurrence_desc`) — position each binary by its
  latest recorded procedural occurrence, newest first.

These are source-system procedural-occurrence dates. They are not necessarily
the dates written in, signed on, or legally effective for a document. The UI
must name the date used to position each binary and retain all recorded
occurrences beneath that binary. Binaries without a recorded occurrence date
sort last in both chronological modes.

Ordering occurs on the server before pagination. The search query collapses
matching passages to a binary-level ordered result, pages those binaries, and
returns the processor-specific matching passages for each selected binary.
This prevents several representations of one PDF from consuming a binary page.
Changing sort starts a fresh offset-zero search; `Load more` continues the
immutable submitted query, scope, and sort. Relevance remains the search
default.

This binary-grouped browsing order is not a procedural timeline. A later
occurrence-based timeline may repeat the same binary at each recorded event;
that separate view is outside this slice.

Implementation status (2026-09-03): this binary-ordering slice is complete.
The API pages binary groups in a stable server-side order and returns every
matching processor passage for each selected binary. The UI defaults to
relevance, restarts at offset zero when the order changes, retains all source
occurrences within each group, and labels the recorded occurrence date used by
either chronological order. A live full-corpus check confirmed oldest-first
and newest-first ordering through the `localhost` UI.

Sort changes must not revive an older completed query while a newer initial
search is pending. During an initial search, the UI may update the selected
sort value but does not submit another request from the previous result. The
pending search remains authoritative and retains the sort with which it was
submitted. The selector is disabled while an initial search or a `Load more`
continuation is pending, and the handler independently guards the
initial-search race rather than relying only on asynchronously updated React
state.

### Planned search-results presentation slice

The next UI-only slice will make each result answer three questions before
showing detailed provenance: what the document is, why it matched, and how to
open the original. It does not change indexing, ranking, grouping, reference
resolution, or evidence semantics.

For text search, each binary card shows the highest-ranked matching passage
already returned for that binary. Selection is deterministic and the preview
retains its processor and version; text from independent representations is
never combined and the preview does not establish a preferred extraction.
Remaining hits are available under `More matching passages`, with their own
representation labels and provenance.

The active chronological order makes its positioning date prominent and labels
it `Earliest recorded occurrence` or `Latest recorded occurrence`. Under
relevance ordering, occurrence dates are context only and are not described as
the reason for position. Repeated occurrences are summarized initially and
expand to complete occurrence and source details. Technical identifiers remain
available but do not dominate the scanning view. The original-file action is
labelled `Open original PDF` where the binary is a PDF.

Search mode remains above the primary input. Text scope stays with the search
controls because it applies only when Search is submitted. Order moves to the
submitted-results heading because it immediately reruns that submitted query
and scope, ignoring unsubmitted control edits. It remains disabled while a
replacement search or continuation is pending. Exact-reference mode instead
states that lookup covers pilot reference observations only. The longer search
coverage explanation is collapsed behind `About search coverage`.

Normal continuation is rendered as neutral status: loaded binary and passage
counts plus whether more results are available. Exact-reference cards must
distinguish source-recorded metadata observations from references mentioned in
document content. Only the latter necessarily has a document excerpt.

Acceptance requires both text and exact-reference examples. Without expanding
a text card, a user must be able to identify the document, see the deterministic
processor-attributed preview, understand any chronological positioning date,
and open the original. Expansion must preserve all occurrences, matching
representations, observation locations, and technical provenance.

Implementation status (2026-09-03): this presentation slice is complete. Live
checks against the full-corpus `marie` search confirmed highlighted,
processor-attributed previews, compact occurrence groups, neutral continuation
status, and submitted-result ordering that ignores unsubmitted input edits. An
exact lookup for `105398957` confirmed that document-text mentions retain their
excerpt while source-system observations are labelled separately without an
invented document excerpt.

### TODO: URL-addressable searches and result navigation

Define and implement a stable query-string contract so a search can be
bookmarked, reopened in another tab, or shared as an application URL. Candidate
state includes search mode, query text, text-search scope, text-result order,
and an explicit decision about whether loading the URL only populates controls
or also executes the search. Exact-reference URLs must not imply full-corpus
reference-observation coverage while that lookup remains pilot-only.

The design must keep draft controls distinct from the submitted result. In
particular, changing result order must continue the submitted query and scope,
not unsubmitted edits. Unknown or invalid parameter values require safe
defaults; mode-specific parameters must not leak into the other mode. Query
encoding, empty values, browser Back/Forward behavior, reload behavior, and
stale overlapping requests need explicit acceptance cases. Pagination offsets
should not be persisted unless a later design can restore the accumulated
pages reliably.

As part of the same navigation review, define whether `Open original PDF`
opens the document detail in a new tab by default. The chosen behavior must
preserve the search context and still produce a normal anchor that supports
browser new-tab actions. External-window links must use the appropriate
`noopener`/`noreferrer` protection.

This is a recorded TODO only. The URL schema and navigation behavior are not
implemented by the current slice.

### Planned corpus-wide recorded-reference expansion

The consultation search will distinguish search method from corpus scope. The
intended user-facing selector is `Search in`, with:

- `Document text` — linguistic full-text search over processor-attributed
  representations;
- `Recorded references` — normalized exact lookup over structured reference
  observations; and
- `Both` — independent execution and presentation of both methods.

`Document text` is the initial default; the application may later remember the
user's last selection. `Both` is orchestration, not a combined search engine:
each section loads, fails, reports empty results, counts, and paginates
independently. A failure in recorded-reference lookup must not hide successful
text results. Results are not merged or assigned a shared ranking, and the same
binary or value may legitimately appear in both sections with different
meaning. `Text result order` affects only the document-text section.

Recorded-reference coverage will expand in two separate phases. First, ingest
references already recorded in metadata across the corpus while preserving the
source record, procedural occurrence, process, linked binary when available,
and explicit missing-binary state. Second, evaluate labelled references found
inside documents on a fixed sample before any corpus-wide expansion. These are
observations, not automatically resolved links; generated and unreviewed
observations may be searchable when labelled honestly.

Three provenance origins remain distinct:

1. court-system metadata;
2. external-register metadata; and
3. document-text observations.

The initial deterministic recorded-reference order is court-system metadata,
then external-register metadata, then document-text observations. Within each
origin, use only the observation's directly anchored occurrence date, oldest
first with unavailable dates last, followed by stable observation identity.
Do not borrow a date from another occurrence of a reused binary. Associated
occurrences remain visible separately as context. Normalized value is not an
ordering key within exact lookup because every returned observation already
shares that value.

The next concrete step is a read-only inventory, before ingestion, schema, API,
or UI changes. It must identify every metadata field capable of containing a
reference and report its source/table semantics; total, populated, distinct,
and malformed counts; coverage by process and occurrence; linked- versus
missing-binary counts; reuse across binaries, documents, or processes;
availability of directly anchored dates; overlap with pilot observations;
normalization effects and collisions; and whether provenance can be reproduced
without inference. The inventory defines the honest corpus-wide coverage claim
and whether individual fields require separate ingestion rules.

Inventory validity is field-specific. Each source field must state its own
documented format contract before counting a value as malformed. Empty values,
contract violations, values that cannot be normalized without information
loss, unusual-but-valid values, and unknown formats are separate outcomes;
unusual values default to valid-but-unclassified or unknown rather than error.
Raw values are always retained.

Validity, normalization changes, and normalization collisions are independent
dimensions. Benign normalization may remove surrounding whitespace or case
differences without making a value invalid. The inventory records every change
and separately identifies distinct raw values that collapse to one normalized
value. Collision analysis retains source field, identifier type, and process
context because equal normalized values in different contexts are not
necessarily conflicting identifiers. Potentially information-losing or
cross-context collisions are flagged for review, not silently resolved.

Once corpus-wide recorded-reference coverage exists, the development fixture
should leave the main user controls and remain available as an evaluation
option. A literal character-for-character text search, if needed, is a separate
future behavior; the linguistic document-text index does not promise it.

The inventory is complete; subsequent ingestion, API, and UI work remain
unimplemented.

Implementation status (2026-09-03): the read-only inventory and the first
metadata-ingestion checkpoint are implemented. The ingestion adds direct case
and occurrence anchors, immutable lifecycle transitions, a truly read-only
dry run, transactional writes, and pilot-metadata reconciliation. Corpus-wide
lookup and the multi-method UI remain unimplemented. Detailed overlap groups
preserve raw-value-to-source associations and include same-field,
same-proceeding reuse across separate source records as well as multiple
occurrence links to the same source document.

### Consolidated metadata-reference ingestion checkpoint

The first implementation checkpoint is limited to schema support, a genuinely
read-only dry run, transactional court-metadata ingestion, and reconciliation
with existing pilot observations. Corpus-wide lookup and the multi-method UI
are later checkpoints.

#### Ingestion set and direct anchors

The checkpoint ingests:

| Source field | Identifier type | Direct anchor |
|---|---|---|
| `case_file.processo` | Process number | `case_file` |
| `case_file.idprocesso` | Source process ID | `case_file` |
| `bucket.reference_number` | Recorded occurrence reference | `bucket` |
| `document.document_procinfo` | Source document reference | `document` |

`bucket.bucket_id` remains available in provenance but is not separately
ingested because all 897 inventoried values duplicate `reference_number`.
External-register ingestion is deferred because `case_workspace_reference`
currently has no rows. Do not add `case_workspace_reference_id` to the
observation schema during this checkpoint.

Add direct nullable `case_file_id` and `bucket_id` anchors to
`reference_observation`, update its anchor constraint, and index both columns.
Do not attach case or occurrence assertions to an arbitrary linked document to
satisfy the existing constraint. Document references retain `document_id` as
their direct anchor and have one current observation per source document; all
procedural occurrences remain associated context rather than duplicated
observations.

#### Pilot reconciliation

Existing pilot metadata observations anchored indirectly through
`bucket_document` are not independent evidence when they describe the same
source assertion as a new directly anchored observation. The directly anchored
observation becomes current. The prior pilot observation remains historical,
keeps its review record and pilot membership, links to its replacement, and is
excluded from ordinary full-scope results. Pilot evaluation may continue to
show historical fixture observations explicitly.

Pilot document-text observations remain active because metadata ingestion does
not replace them. Existing pilot external-register observations also remain
active and explicitly limited in coverage. The supported claim after this
checkpoint is `corpus-wide court-metadata coverage; external-register coverage
remains limited to the pilot`.

#### Identity, lifecycle, and versioning

A stable source assertion is identified by origin, source field, source record,
and identifier type. Observation lifecycle is explicit:

- `current`;
- `superseded`; and
- `retired_source_absent`.

A changed raw source value creates a new current observation and supersedes the
former observation. A disappeared source value retires the former observation.
Neither action deletes historical reviews. Observer, ingestion, and
normalization versions remain provenance. If a version changes the normalized
value for unchanged raw input, retain and link the previous derived
observation rather than silently overwriting its meaning. Ordinary lookup later
returns current observations by default; historical observations require an
explicit history or diagnostic mode.

Lifecycle transitions are immutable, timestamped events; current lifecycle
state is maintained separately. A single `superseded_by` pointer is not a
sufficient history because A -> B -> A would otherwise be ambiguous or cyclic.
If a disappeared value returns, reactivate its historical observation only when
both the raw value and normalization identity match. For A -> B -> A under the
same normalization identity, record both transitions and make the original A
observation current again. If the raw value is unchanged but the normalization
identity changes its meaning, create a separate derived observation instead of
reactivating the old one. At most one observation may be current for each
stable source assertion; exactly one is current when the source value is
present, while an absent source value legitimately leaves none current.

An existing review remains attached to a reactivated observation. Reactivation
must not change its reviewer, review timestamp, review notes, or imply that a
person reviewed the source again. Lifecycle-event provenance records the
reactivation independently from human-review provenance.

Routine reseeding must not overwrite `reference_observation_review`. The
reconciliation plan must classify inserts, unchanged/refreshed current rows,
supersessions, retirements, retained reviewed rows, and historical pilot
replacements separately.

#### File association states

Reference provenance does not force a single binary. Associated documents and
binaries are contextual collections with one of these factual states:

- `no_direct_binary_association`;
- `all_associated_files_available`;
- `all_associated_files_missing`; or
- `mixed_file_availability`.

Process references naturally have no direct binary. Multi-document occurrences
retain every associated file. Missing-file source documents remain searchable
from metadata. A document-level observation does not borrow an arbitrary date
from a reused binary or occurrence; occurrence references alone use their
directly anchored `bucket_date` for ordering.

#### Dry run and transactional reporting

Dry run computes the complete proposed change set without issuing mutation
statements. It must not simulate writes followed by rollback because sequence
allocation and other effects can survive a rollback. Write mode is
transactional and builds its plan only after opening a repeatable-read
transaction, so the plan and its mutations share one consistent database
snapshot. It reports attempted counts separately from committed counts.
Committed counts are emitted only after successful commit; after rollback they
are zero and the failure is reported without implying partial persistence.

The implementation command should support explicit dry-run and write modes and
emit deterministic structured diagnostics. It must not delete pilot
document-text or external-register observations and must remain idempotent when
source data and ingestion versions are unchanged.

#### Acceptance gate

Before this checkpoint is complete, automated and bounded database validation
must cover:

- direct case and occurrence anchors;
- one document observation with multiple occurrences;
- reuse across processes and separate same-date occurrences;
- a multi-document/multi-binary occurrence, including mixed availability;
- a process reference with no direct binary;
- a missing-binary document reference;
- suppression of duplicate `bucket_id`/`reference_number` observations;
- reconciliation of an existing pilot metadata observation;
- preservation of its review and pilot identity;
- retention of pilot document-text and external-register observations;
- changed and disappeared source values;
- disappearance followed by return, including A -> B -> A reactivation under
  the same raw value and normalization identity;
- a normalization-version replacement;
- deterministic reruns without duplicate observations;
- raw-value preservation and no inferred target resolution;
- dry run issuing no writes or sequence allocations; and
- attempted versus committed counts on success and rollback.

The acceptance sequence must also rerun the legacy pilot seeder after
reconciliation and prove that it cannot reactivate replaced pilot metadata,
create another current observation, or alter lifecycle transitions. It must
preserve all reviews and pilot membership while leaving pilot document-text and
external-register observations active.

After ingestion, inspect current and historical rows for a fixed sample before
starting corpus-wide API lookup or UI changes.

### Planned read-only recorded-reference API checkpoint

The next checkpoint exposes the persisted reference observations through the
consultation API. It is read-only: requests must not trigger ingestion,
reconciliation, lifecycle transitions, or review updates. The combined search
UI remains a later checkpoint.

API scope and lifecycle are independent dimensions:

- corpus scope is explicitly `pilot` or `full`;
- lifecycle scope is `current` or `include_history`, defaults to `current`, and
  requires `include_history` to include `superseded` and
  `retired_source_absent` observations.

Selecting history must not widen corpus scope, and selecting full scope must
not include historical observations implicitly. Superseded legacy pilot
metadata must appear only when history is explicitly requested and must not be
returned as a second current observation beside its directly anchored
replacement.

#### Request and pagination contract

The endpoint is:

```text
GET /api/consultation/references/lookup
```

It accepts only these query parameters:

| Parameter | Required | Values and default |
|---|---:|---|
| `value` | yes | Non-empty raw reference lookup value; normalized by the existing reference normalizer |
| `scope` | no | `pilot` or `full`; default `full` |
| `lifecycle` | no | `current` or `include_history`; default `current` |
| `limit` | no | Integer from 1 through 100; default 50 |
| `offset` | no | Observation offset from 0 through 1,000,000; default 0 |

Unknown enum values, out-of-range integers, undecodable values, and an empty
normalized lookup value return HTTP 400 with a stable error code. The route
performs normalized exact lookup; it is not literal character matching and
does not resolve a reference target.

Pagination is observation-based. Because one request looks up one exact
normalized value, it does not paginate grouped reference values. The response
envelope is:

```json
{
  "query": {
    "raw_value": "...",
    "normalized_value": "...",
    "scope": "full",
    "lifecycle": "current"
  },
  "result_state": "matches",
  "coverage": {
    "corpus_scope": "full",
    "lifecycle_scope": "current",
    "status": "incomplete",
    "included_origins": [
      "court_metadata",
      "external_register",
      "document_text"
    ],
    "limitations": [
      {
        "code": "NON_COURT_METADATA_COVERAGE_IS_PILOT_ONLY",
        "message": "External-register and document-text observations remain pilot-scoped."
      }
    ]
  },
  "pagination": {
    "unit": "observations",
    "limit": 50,
    "offset": 0,
    "returned": 12,
    "has_more": false,
    "next_offset": null
  },
  "observations": []
}
```

`next_offset` is the current offset plus the number of observations returned
when `has_more` is true, and otherwise is `null`. The implementation may fetch
one extra row to determine `has_more`; that row is not returned or counted in
`returned`. No total count is promised by this checkpoint.

Recorded-reference results paginate independently from document-text search.
They use the agreed deterministic order: court-system metadata, then
external-register metadata, then document-text observations; within each
origin, directly anchored occurrence date oldest first with unavailable dates
last, followed by stable observation identity. Pagination must preserve that
ordering and must not borrow dates from associated occurrences.

Each result keeps these concepts separate:

- the observed raw and normalized reference value;
- `direct_anchor`, identifying the record or representation where it was
  observed;
- `associated_contexts`, containing related occurrences, documents, and
  binaries without presenting them as the observation anchor;
- lifecycle state;
- provenance origin;
- ingestion/observer identity and version;
- human-review state and reviewed resolution, if present;
- ingestion target candidates, kept separate from reviewed resolution; and
- binary-association state;
- `associated_binaries`, a collection deduplicated by full SHA-256.

Every `associated_binaries[]` entry contains its full SHA-256 identity,
availability, optional API-relative open action, and nested document and
occurrence associations. Associations are accumulated when the same binary is
linked through several documents or occurrences; deduplication must not discard
those contexts. The API does not select a preferred binary. Missing-file
records remain in `associated_contexts`; they do not become binary entries with
invented identities and never receive an open action.

Every response describes its coverage independently from its matches. At
minimum it reports the selected corpus and lifecycle scopes, included origins,
and known coverage limitations. `result_state` is exactly one of `matches`,
`no_matches_within_coverage`, or `coverage_unavailable_or_incomplete`.
`coverage.status` is exactly one of `complete_for_declared_sources`,
`incomplete`, or `unavailable`; `coverage.limitations` is a list of stable-code
and human-readable-message objects rather than an overloaded result string.
`matches` takes precedence when observations are returned. With no returned
observations, complete declared coverage produces `no_matches_within_coverage`,
while incomplete or unavailable coverage produces
`coverage_unavailable_or_incomplete`.
A no-match response must not imply that the referenced document or event is
absent from the court record.

The API acceptance gate covers current-only and history queries, independent
pilot/full scope behavior, stable pagination, all three provenance origins,
direct anchors versus associated contexts, reviewed resolution versus
ingestion candidates, missing and mixed binary availability, and suppression
of superseded pilot duplicates. Saved responses and focused API tests must pass
before the multi-method UI checkpoint begins.

## Review ownership and reseeding

Ingestion and human review have different ownership. Routine ingestion may
refresh observation-owned facts such as the exact value, source anchors,
extractor context, and ingestion hints. It must not reset a human decision about
namespace, role, target candidates, confidence, review state, or reviewer notes.

Human decisions are therefore stored in a separate one-to-one
`reference_observation_review` record. Consultation reads the review as an
overlay while retaining the original observation. This also makes the reviewer,
review timestamp, and notes independently attributable.

For the bounded document-text extractor fixture, an unreviewed observation from
an older extractor version may be removed. An observation with a review must be
retained; the new extractor output is recorded separately under its new stable
observation identity. Reconciliation between those observations is a later
review action, not an ingestion-side overwrite. The stricter lifecycle above
applies to source-metadata assertions and their normalization replacements.

## Known limitations

- Existing segments have no page mapping.
- Extracted labelled references are observations, not resolved identities.
- The database does not yet enforce cross-column consistency among every nullable
  provenance anchor; writers must use anchors from the same lineage.
- Exact-reference consultation remains fixture-scoped; full-corpus Text search
  is an explicit experimental scope.
- The fixture validates the contract but is not evidence of corpus-wide recall.
