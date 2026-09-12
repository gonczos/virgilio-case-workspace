# Scraper-prepared exchange — consumer coordination

Recorded 2026-09-12. Status: producer draft received and reviewed; format agreement pending. No new normalization implementation, import/export run or live access authorized.

## Scope and dispatched request

The user assigned source-material cleanup to the scraper, then asked to coordinate its
work. The next bounded step is to agree a concrete output draft before implementing a
new producer/consumer contract. Virgilio input: 07a2a723eee9a41c02ab4e7440fc311ab46e3aa3.
See [ownership clarification](13-retained-response-usefulness.md).

Sent to scraper task Define data contract boundaries,
01a095c2-def6-7cb2-a7fb-6015cde04d52: draft normalized versioned output and an implementation
gap plan using retained evidence. Include structural/synthetic examples for case context,
participant summary/detail occurrences, acts, document occurrences/descriptors, retrieval
locators, acquisitions/binaries, scope/limitations and supporting original references.
Declare exact producer interpretation version/rules/input lineage. Keep raw/display values,
unknown IDs/digests and nil/zero/date semantics explicit. Do not make Virgilio understand
Citius wrappers, duplicate arrays or raw endpoint response shapes to consume the exchange.

Distinguish current implemented state from required new event/revision/replay/output
machinery. Propose one compact chain from case through act/document/locator/acquisition
to bytes, plus participants and required support. Version labels remain draft proposals.
Represent finalized snapshots, corrections and supplements without independently closing
R3 granularity or R5 branch policy. No supplied comparison differs from supplied not-assessed;
comparison claims need exact inputs/revisions. R2 supporting dependencies/custody remain
mandatory for chosen claims, without implying current Virgilio acceptance.

Return committed planning documents, example format, consequential choices and bounded
implementation gaps/tests. No normalization/runtime changes, collection, DB/import/export
runs, new binary processing or Virgilio edits. Existing response-preservation development
and its pending live validation remain a distinct slice.

## Consumer adequacy checks

| Requirement | What the draft must let Virgilio do without re-parsing Citius |
| --- | --- |
| Navigate evidence | Follow case/act/document occurrences, retaining observed multiplicity and scoped source references |
| Inspect participants | Read names/designations and occurrence context while preserving summary/detail separation; no automatic person merge |
| Understand source retrieval | Distinguish listing token/locator, actually transmitted context, acquisition outcome and saved-byte identity |
| Interpret values faithfully | Receive explicit normalized value plus relevant raw/display distinction, declared unknowns and source-interpretation basis |
| Preserve history | Distinguish new events, replay, producer correction and evidence supplement; trace exact predecessors/inputs without current-state replacement |
| Assess scope | Know intended/observed scope, listing versus acquisition coverage and meaningful limitations; absence not inferred from empty or missing data |
| Validate evidence support | Resolve declared original/mapping/rule/binary dependencies and their integrity under R2; raw bodies are support, not the required ingestion parser interface |
| Map into VIEC | Apply a separately attributed mapping from exchange fields, keeping producer and adapter corrections distinct; broker final acceptance |

The existing three agreed directions remain: preserve capturable responses, normally
seek differences in open cases, and structure participants as reported. Detailed R3/R4/R5,
complete contract acceptance and final version assignment remain open. This coordination
must produce a reviewable producer proposal, not silently establish an implemented API.

## Producer draft received and consumer adequacy review

Scraper checkpoint: 25bce3d84e700e3ce738c44925554471bd99bc5d.
Draft: C:/repos/scraper/repository/docs/20-roadmap/phase-04-evidence-contracts/normalized-output-proposal.md.
Read the complete draft during coordination and verified it matches the committed file.
The label scraper-prepared-evidence / draft-1 is a discussion identifier, not a final
version assignment. The scraper read Virgilio ownership/usefulness input at 07a2a72.

The draft provides logical groups for format/producer, snapshots/evidence sets, events,
interpretations/rules, case context, participant summary/detail, acts, document appearances
and descriptions, retrieval references, relationships, acquisitions/binaries, assessments,
coverage/comparisons, revisions and required materials. Its synthetic graph connects the
navigation chain and keeps repeated participant appearances distinct. The example is
explicitly abbreviated, not a valid complete delivery fixture or an implemented API.

### Adequacy against consumer needs

- Ownership is correct: known Citius wrapper/alias/normalization rules stay in the scraper;
  Virgilio consumes defined fields and maps them to VIEC. Original selectors are provenance
  hints, not instructions to make the receiver parse raw bodies.
- Values distinguish reported, explicit null, source nil, empty, absent and unrecognized;
  zero remains reported. Source/display labels, act/document dates and different size
  measures remain separate with attributed rules. Proposed date precision still needs
  agreed mapping rules; the draft does not make zero clocks UTC instants.
- Individual appearances, summary/detail participants, source retrieval locators, actual
  acquisitions and binary byte identity are separate. Opaque IDs/source hashes and inferred
  relations are not promoted into verified identity or cross-case acquisition claims.
- Exact source inputs, producer rules and delivered normalized assertions remain preservable
  under R2. Stable event/revision references and mapping provenance support history without
  silently using paths, row indexes, token equality or byte equality as event identity.
- Finalized partial outcomes, corrections/supplements and later comparisons are represented;
  no supplied comparison differs from supplied not-assessed. R1 exact-input applicability,
  broker final acceptance and unresolved revision branches remain intact.

No material contradiction with the agreed ownership/evidence foundation was identified.
The draft is sufficient for the next format discussion; this is not schema conformance,
independent contract review, complete-contract acceptance or approval to implement it.

## Concrete scraper-side work still needed

| Preparation work | Current boundary / next specification need |
| --- | --- |
| Versioned source normalization | Capture and some extraction exist; define complete mappings/unknown handling for the proposed record groups using retained input fixtures |
| Replay and output revision identity | Existing event/run fields are inputs, not a complete persistent exchange ledger; specify producer-assigned replay identity and legacy attribution without fabricating history |
| Scope, corrections and comparisons | Runs provide evidence, not complete R4/R5 machinery; settle exact policies and revision interface with coordinated acceptance semantics |
| Serializer and material declarations | Current portable export does not implement this format; define complete material/rule references and required dependency closure after agreement |
| Conformance fixtures | Expand the illustrative graph into valid bounded examples for normal partial evidence, replay, correction, supplement, missing dependency and unresolved branch scenarios |

These are gaps to plan, not a newly authorized implementation checklist. The earlier
case/act preservation implementation remains separately committed at 537bdfa with offline
tests passed and bounded live validation pending authentication. No new live evidence
was required or produced to prepare this format draft.

## Next coordinated decision

Review whether the normalized record/value groups meet consumer needs, then resolve R3
acceptance units/dependencies/legacy handling alongside R4 matching/coverage/replay and
R5 revision scope. Before new output implementation, complete agreed mappings and valid
fixtures instead of treating the abbreviated JSON as a frozen schema. The scraper owns
that source preparation; Virgilio reviews contract meaning and its VIEC mapping boundary.

Scraper reports illustrative JSON parsing and graph/multiplicity checks, relative links
and staged/unstaged diff checks passed; clean tree and no push. Those are documentation
checks, not conformance tests or runtime validation. Virgilio checked planning links and
diffs, preserved unrelated ideas/, and made no runtime/import changes.
