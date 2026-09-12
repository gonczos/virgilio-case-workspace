# Revised collection scope — coordinated proposal

Date: 2026-09-12. Status: coordinated proposal received/reviewed; user scope decisions pending.
No new live access, acquisition, implementation, import/export or assessment authorized.

## Inputs and coordination request

Virgilio input: 15d57423ca46b4ed6bac8f11fe314adf4db9d0a9. Scraper handoff:
c6956c2b07cdbb0aacbc9df87113de6e9d8cbcf3. See the
[handoff and user-directed reevaluation](10-scraper-extension-handoff.md).

The user asked for direct coordination. Sent to scraper task
01a095c2-def6-7cb2-a7fb-6015cde04d52, Define data contract boundaries:
produce a revised field/group matrix using committed findings only. For each group,
separate observe/acquire, preserve original evidence, derive structured fields, and
consultation exposure (proposed, Virgilio-owned). State implemented versus proposed,
source scope, relevance, prerequisites, cost known versus unknown, and required support
versus optional scope. Cover case/participant context, IDs, case/act responses, listing
attributes, relationships, acquisitions/source digests, media limitations and operations.
Evaluate selective case/act response preservation concretely, not blanket traffic logging.
Compare full scoped retrieval, subset/rotating/age-based refresh, and listing-triggered
selection without claiming unchanged bytes for unrequested items. Keep source digest
semantics uncertain, acquisitions scoped and persistent media distinct from transport
retry. Recommend a coherent scope and consequential user choices. Commit own planning
documents; no Virgilio edits, runtime work or new investigation. R3–R5 remain open.

## Virgilio-side proposed priorities

| Group | Observe/preserve | Structured interpretation and consultation proposal |
| --- | --- | --- |
| Case context and participants | Retain implemented source observations, separate row summary/detail and original support | Names/designations, case descriptors and occurrence context are useful; counts remain entry counts, not unique people |
| Additional participant IDs and sensitive values | Preserve required source response with explicit scope | Keep raw scoped context inspectable under eventual access policy; no default sensitive-ID indexing/display or person merging proposed |
| Case/act responses | Propose selective preservation of original responses on declared existing routes, actual response scope and context | Map useful date/description/count/membership fields; preserve original forms and missing-value distinctions rather than normalizing prematurely |
| Document format/type/order/source digest | Preserve original source attributes and exact inputs | Expose as labelled source fields where useful; order is not identity, reported format not binary validation, source digest not verified SHA-256 |
| Relationships | Preserve observed listing membership and actual acquisition context | Distinguish source occurrence links from supported inferences; uncertain participant links and legacy parents remain labelled context |
| Binaries and unavailable media | Preserve actual obtained bytes, request context and meaningful unavailable outcomes | State what was acquired and when; source placeholders do not become binaries or transient failures |
| Operations | Preserve according to scraper's obligations and evidentiary dependencies | No consultation representation for ordinary recovered diagnostics without consequence |

Proposals for exposure are not implemented UI or access policy. Exact supporting
originals remain required under R2 when supporting a selected claim, irrespective of
field prominence. Declared response scope can exceed the case/act selected for a view;
retain that distinction without manufacturing narrower original evidence.

## Binary refresh: the consumer decision

Different questions require different collection policies. A listing-focused run can
answer what was listed and obtain selected candidates; it cannot answer whether every
previously available binary still returns the same bytes. A full scoped acquisition can
observe each successfully requested context at its own request time, but not establish
simultaneous state, unrequested cases, or source changes between observations.

A mixed policy may be useful if its selected contexts and unassessed remainder are
explicit. It needs a defined budget/selection rule, not an implied promise of complete
change detection. Existing historical bytes remain evidence with their original dates.
Unknown source-hash semantics preclude using them as verified byte-equivalence tests.
Which assurance/cost trade-off the first collection profile should offer is a user
choice. This review initiates no retrieval and chooses no final R4 policy.

## Decision sequence

Agree the candidate collection/preservation scope and intended observation assurance;
resolve consequential interpretation/exposure choices; then use them to define R3
required material, dependencies and acceptance units with scraper-led R4 policies.
R5 revision scope remains joint. Neither complete contract is accepted by this matrix.

## User question: references to the site's binary downloads

The user asked whether source-side download references are retained. Read the existing
representative downloader record/request code during this coordination (no request run).
It retains document_procinfo, representative case/bucket/document context, retrieval
parameters, response_url/status/type/disposition and saved response hash/size. The
request sends infotecnica plus idprocesso/idcliente/idtribref/tipoConteudo to the download
action. Recorded idunorgref is not sent by this inspected path. This is an authenticated
POST locator/context, not an established permanent direct binary URL.

The revised matrix must keep distinct: observed source download affordance/token;
request locator and actually transmitted context; actual acquisition event/outcome;
source-reported digest with unverified semantics; and measured saved-byte identity.
A reference can exist without a successful acquisition and can return different bytes
or a placeholder later. Equal references do not prove same bytes or another case's
acquisition. Current portable projections omit much of the retained request context.
This requirement was sent directly to the scraper's active matrix task.

## Scraper matrix reviewed: consumer assessment

Read the scraper's revised-collection-scope-matrix.md during coordination; the completed
checkpoint is recorded below. Its proposed scope aligns with the consumer priorities
above and explicitly includes source download references. No substantive contradiction
with the accepted foundation was identified; this is coordination, not independent
conformance verification or acceptance of scope.

The coherent candidate keeps implemented case/participant context, individual listings,
actual acquisitions and limitations; adds selective original case/act response preservation
and useful source-labelled document attributes; and defers uncertain identity/relationship
interpretation, executive expansion and new assessments. The additional response capture
is proposed on routes already used in ordinary collection, with no extra fetch solely
for preservation. Implementation, storage volume and general live behavior remain to
be established; this matrix authorizes none of them.

Virgilio supports three recommendations for user decision:

1. Add selective case/act originals to the candidate scope, with actual response membership
   and supporting dependencies. This retains observed raw facts and interpretation basis
   that rendered captures alone cannot provide. It is not blanket network logging.
2. Keep names/designations, multiplicity and observation context as proposed consultation
   fields. Retain uncertain/sensitive identifiers in required originals; promote interpreted
   identity/relationship fields only for a stated use with appropriate access treatment.
3. Make binary assurance an explicit profile choice. Listing-triggered acquisition plus
   a separately declared bounded refresh is a reasonable candidate when partial freshness
   is acceptable. Full retrieval is the appropriate candidate when current-byte observation
   throughout a declared scope is required. Neither policy/cadence/budget is selected here.

### Comparison of binary assurance options

| Proposed policy | What is observed | What remains unassessed |
| --- | --- | --- |
| Full retrieval in declared scope | Returned bytes for each successful request context | Failed/unrequested contexts, changes between requests, simultaneous state |
| Bounded subset/rotation/age refresh | Returned bytes for explicitly selected successful requests, including unchanged listings | Current content of everything outside the refreshed subset |
| Listing-triggered acquisition | Returned bytes for selected new/altered/unresolved listing candidates | Swapped content behind unchanged descriptions; current content of reused historical acquisitions |

Define retrieval scope separately from coverage of listing cases. Full representative
retrieval still does not establish a request through every case referencing those bytes.
Observed source digests remain separate from measured hashes and cannot certify byte
identity without established semantics. The source POST locator remains evidence of
how to request an item, not a promise of a durable direct hyperlink or unchanged content.

Persistent media outcomes need a separate reconsideration reason, such as changed
source capability/content type or explicit review. The matrix does not propose routine
retries for all 39 placeholders. Historical results and any newly obtained response
remain separate evidence events.

## Remaining user decisions

Select original-response preservation versus a scope limited to rendered observations;
choose the required binary assurance and context coverage (then budget/cadence); and
identify any participant-ID interpretation beyond names/designations that is actually
needed. These choices set collection scope before R3 delivery/dependency conformance.
No accepted scope, implementation or additional live work is implied by recommendations.

## Completed paired planning input

Scraper matrix checkpoint: 3c9b25fcf9a2310b2ba6861d51f9ee394d24c7ea.
File: C:/repos/scraper/repository/docs/20-roadmap/phase-04-evidence-contracts/revised-collection-scope-matrix.md.
The reviewed working document matches that committed version. The scraper also returned
its prior c6956c2 handoff; no new source/runtime findings are implied by the matrix.
Scraper reports link/staged-diff/whitespace checks passed and a clean working tree.

Virgilio has reviewed the proposed scope and recorded its consumer recommendations and
remaining choices above. Coordination is complete for this matrix; scope acceptance is
pending. R1/R2 and the accepted semantic foundation are unchanged, R3–R5 remain open.
No live requests, imports, implementation or assessments were performed in this slice.

## Decision 1 agreed: preserve capturable source responses

The user was led through the three open decisions as planning choices, explicitly not
development authorization. After clarifying that the proposal covers backend responses
for cases, buckets/acts and nested documents as well as participant popups, the user
stated: "The scraper should keep the responses we can capture".

Record this as agreed collection/preservation direction for source responses supporting
the declared activities: case listings/context; bucket/act and nested document responses,
including pagination; participant expansion; and separate download responses with actual
acquisition context. Preserve original captured bodies, actual response scope, observation
and request context, provenance and integrity identity. Required broader response contents
are not silently rewritten into a narrower original. Binary evidence retains its separate
identity and acquisition lineage.

Some popups render previously received data; this decision does not require duplicate
requests solely to manufacture a popup response. The discussed scope is selected source
responses supporting collection, not unrelated network traffic, credentials or speculative
endpoint exploration. Capture limitations stay explicit; no promise of full wire/session
recording or recovery of unobserved past responses follows.

Original preservation is distinct from interpreting fields, showing them by default,
certifying source correctness or accepting a delivery. Participant response preservation
is already implemented; general case/act preservation remains to be implemented in a
separately authorized slice. Exact capture/dependency/acceptance rules remain R3/R4 work;
R5 and complete contracts remain open. No runtime action is authorized by this decision.

The decision was sent directly to the scraper for matching planning documentation.
Decision 1 supersedes the pending-original-response choice above. Decisions 2 (binary
refresh assurance, context coverage and budget/cadence) and 3 (participant interpreted
exposure) remain open. Continue guiding the user through decision 2 next.

Scraper aligned decision 1 at cf8d72cb55aae35f4b3ddc0f056aa0fae29f272b,
with no material scope conflict reported. Its matrix, index and decision record were
updated; no runtime changes. General case/act preservation remains unimplemented.

## Decision 2: normal focus on differences in open cases

The user proposed focusing normally on open cases, keeping full scrapes possible on
demand and potentially suggested periodically (monthly was an example), following
scrape-contract changes or unexpected binary hashes for known retrieval references.
After discussing the qualifications, the user confirmed: "So yes, normally we target
diff in open cases."

Agreed planning direction: routine collection targets differences in open cases.
Preserve new observations and their exact comparison basis rather than replacing history.
Full scrapes remain an on-demand capability to plan. Periodic or anomaly/contract-driven
suggestions are candidates for a broader check, not an automatic execution policy.
No monthly schedule, monitoring automation, live scrape or implementation is requested.

Keep listing coverage and binary retrieval coverage separate. A normal diff-focused run
does not establish unchanged current bytes for historical acquisitions it did not refresh.
Known retrieval references do not guarantee identical contents. Preserve an unexpected
returned hash/body as a scoped acquisition observation, then investigate its reference
and case before broadening; do not propagate a source-change claim to unobserved cases.
A contract change may require reinterpretation of retained inputs rather than recollection.

Direction is agreed; detailed R4 policy remains open: how open cases are selected and
status transitions detected, exact baselines/matching rules, ordinary binary selection,
full-scrape listing versus retrieval scope, and when to suggest broader checks. No exact
cadence or budget is selected. Closed cases are not excluded from explicit broader scope
by this normal focus. Decision 3 (participant interpreted exposure) also remains open.
R1/R2 and the semantic foundation are unchanged; R3–R5/full contracts remain open.

## Decision 3 agreed: reported participants without automatic identity resolution

After concrete fictional examples distinguishing source reporting from identity/relationship
interpretation, the user agreed to the recommendation: structure reported participant names,
source designations and observation context; retain every occurrence; preserve other source
fields without automatically merging people or assigning unestablished relationships.

Keep summary slots and expanded entries distinct. Repeated names within or across cases
remain recorded appearances, not proof of duplicate defects or a single verified person.
Preserve scoped IDs, sensitive identifiers and possible association fields in original
support/context. Their preservation does not make them default searchable identity fields
or establish representation/principal/legal relationships. Verified identity resolution,
automatic cross-case person merging and such relationship interpretation are outside this
agreed first-phase participant direction. No source field is erased by deferring its use.

This supersedes the pending decision-3 status above. All three high-level directions are
now agreed: preserve capturable responses supporting collection; normally target differences
in open cases with broader checks separately available/proposed; and structure participants
as reported with occurrence/provenance intact. This does not close detailed R3 delivery,
R4 coverage/matching/refresh policy or R5 revision questions, accept full contracts, define
final UI/access behavior or authorize implementation/imports. Next planning step: turn the
agreed scope into concrete delivery/dependency requirements, coordinating remaining R4/R5.
