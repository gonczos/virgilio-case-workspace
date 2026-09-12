# Joint review and next steps

Status: independent joint review completed 2026-09-12; findings open, contracts unaccepted.

## Review scenarios

| Scenario | Required distinction |
| --- | --- |
| Identical fresh collection | New observation/event, possibly shared stored bytes |
| Replay of the same evidence | No invented collection or acquisition |
| Metadata changes | Justified match, both observations retained |
| Bucket gains unchanged document | Altered membership, separately assessed document metadata |
| Item missing from complete listing | Absence qualified to assessed scope, not court deletion |
| Partial/failed listing | Not assessed where coverage is insufficient |
| A returns Y instead of X, B unobserved | A-scoped acquisition change; no observed change propagated to B |
| One representative retrieval | Actual attempt distinguished from inferred reuse elsewhere |
| Parser correction | New interpretation, not new source observation |
| Coverage correction | Original declaration plus attributed revised assessment |
| Omitted historical artifact | Supported supplement or unresolved attribution; discovery time is separate |
| Adapter succeeds but broker rejects | No accepted evidence; final acceptance belongs to broker |
| Mapping rules corrected | Exact upstream lineage, attributed mapping revision; no invented scraper correction/source event |
| Incomplete delivery then retry | No partial accepted evidence or duplicated source events |
| Same bytes repackaged or relocated | Operational change alone is not immutable evidence conflict |
| Conflicting revisions | Explicit attributed resolution; no arrival-order winner |
| Evidence arrives before comparisons | Availability explicit; later results reference exact revisions |
| Practical case grouping | No invented court relationship |
| Legacy package | Unknown chronology/coverage remains unknown |
| Event-based provider or future Citius API | No invented scrape semantics or acquisition; core VIEC unchanged where meanings fit |

## Joint review questions

1. Do identities distinguish source tokens, description variants, occurrences,
   collection events, attempts, content and delivery units without overclaiming?
2. Does coverage support each absence and each unchanged claim? Can resumed attempts
   falsely suggest simultaneous state or completeness?
3. Are required dependencies and the acceptance unit sufficiently precise?
4. Can all earlier accepted states and derivations remain traceable through corrections,
   supplements, conflicts and late arrivals?
5. Does the Citius profile faithfully map to VIEC without making Citius concepts universal?
6. What belongs to the Evidence Broker, provider adapter and upstream collector?
7. Which reported implementation gaps are verified, and what historical reconstruction
   is actually supported by retained artifacts? Do not presume irreversible loss.
8. What version compatibility obligations apply to independently released modules?

## Sequence

- Complete the provider-independent VIEC and Citius profile split jointly with scraper.
- Identify a concrete Git checkpoint for coordinated independent review of both sides.
- Reviewer returns contradictions, missing obligations and decisions; no implementation.
- Resolve findings and record explicit contract acceptance before promoting architecture.
- Plan one bounded implementation slice with validation and migration decisions.
- Begin development only when separately authorized.

Do not run imports, scrapes, migrations, expensive processing or deployment as part
of planning. No runtime prerequisite or startup procedure changed in this checkpoint.
The local API idea is a candidate delivery mechanism, not an agreed implementation.

## Coordinated review inputs and alignment outcome

The user supplied the scraper alignment response against Virgilio checkpoint
`a175724e7e8fdbf08718837d08ab38071c701c4f`. It reported no substantive contradiction
and requested explicit acceptance authority, mapping provenance and version-label
clarification. Those clarifications are incorporated in Virgilio planning revision 2.
This is alignment work, not independent review or contract acceptance.

Pinned scraper input: `8f6b1b7e42406387d38040e6b652def5ae706153`, tag
`scraper-0.2.6-baseline`, in `C:/repos/scraper/repository`:

- `docs/20-roadmap/phase-04-evidence-contracts/citius-scraper-contract-proposal.md` — revision 3.
- `docs/20-roadmap/phase-04-evidence-contracts/decisions-and-review.md` — revision 3.
- `docs/20-roadmap/phase-04-evidence-contracts/implementation-grounding.md`.

The tag-to-commit resolution, both revision headers and grounding-file existence
were checked locally read-only. This does not independently verify every reported
implementation finding. The scraper's preserved exchange draft is historical input;
Virgilio's current checkpoint supplies the broker/VIEC split and mapping clarification.

Use the Git commit containing this revision-2 brief as the updated Virgilio review
input, rather than silently treating the earlier a175724 checkpoint as amended.
Record that resolved full commit hash in the independent-review prompt. The upstream
contract version remains unassigned; the pinned revision/commit provides exact identity.
The scraper application tag is not a contract version or a 0.3.0 release commitment.

Matching, completion criteria, acceptance granularity, supplement attribution,
revision resolution and comparison details remain open review questions. No
additional implementation decisions are required merely to select these inputs.

## Independent review result

The [review request](review/01-request.md) pins both inputs explicitly.
The [findings](review/02-findings.md) report no substantive cross-project contradiction,
with R1–R2 recommended for resolution before contract acceptance and R3–R5 retained
as implementation-readiness decisions. The review did not alter the contracts or
approve development. Next: discuss R1–R2 jointly and return proposed clauses for a
bounded follow-up review; keep owner-assigned R3–R5 visible in implementation planning.

## Follow-up preparation after joint wording agreement

R1/R2 clauses are incorporated on the Virgilio side in planning revision 3. See the
[resolution tracker](review/03-resolution-tracker.md). The prior pinned inputs and
review findings remain historical. The follow-up must use this incorporation's Git
commit plus the scraper's amended checkpoint, which has not yet been supplied.
The same reviewer will assess R1/R2 only, including consistency with prior obligations;
R3–R5 remain visible and neither contract is accepted by this drafting step.

## Focused follow-up completed

The [follow-up result](review/06-follow-up-result.md) verifies R1/R2 resolved in
Virgilio a1051bc94a6180652483e1e7f5fd62ba875b8690 and scraper
8a046a37fabe1cace268ed40e0ad4be944f94f57. This supersedes the pending-review status
above without changing those historical inputs. R3–R5 remain open; neither contract
is accepted or implementation-authorized. Next: decide contract acceptance explicitly
and plan the owned R3–R5 conformance, coverage/matching and revision-resolution work.

## Accepted semantic planning baseline

The user accepted the reviewed foundation for planning only. Its bounded scope is
[recorded in architecture](../../architecture/24-virgilio-2-semantic-planning-baseline.md).
The previous pending-acceptance entries are historical. Complete-contract acceptance
and development remain outside this decision. Continue with R3 delivery/acceptance
planning, coordinate scraper-owned R4, and keep joint R5 visible. No runtime actions.

## Current sequencing refinement — evidence and consultation first

The user raised richer scraper evidence and its effect on consultation before detailed
R3 planning. The current slice is
[evidence availability and consultation needs](05-evidence-and-consultation-planning.md).
Inventory retained versus exported versus newly collectable information, then map it
to consultation questions and proposed default/history views before selecting the
first exchange's required contents. The [scraper prompt](prompts/01-scraper-evidence-inventory.md)
is saved; no investigation result or dispatch is implied. This refines the sequence
above without changing the accepted foundation or closing R3–R5. Planning only.

## Direct evidence-scope coordination

The user authorized direct coordination with the scraper task to determine meaningful
collected data. The [request](prompts/02-meaningful-evidence-coordination.md) and
[Virgilio evaluation criteria](08-meaningful-evidence-scope.md) are recorded.
This replaces manual message relay for this planning slice. Propose structured data,
required supporting material, conditional evidence and upstream-only diagnostics
before detailed R3/R4 rules. It does not accept the complete contracts or authorize
implementation. Screen design remains deferred.

The coordinated proposal and pre-database omission analysis are now recorded in the
scope document, paired with scraper 0ee30fe42b1d0f53cd411e7d35a119f1eaf914a3.
The first relevance scope and collection/assessment selection remain proposals for
user decision. Required evidence availability/mapping checks precede detailed R3 rules.

## Broader collection planning authorized

The user selected option 3 for planning and asked both projects to work together.
The [future collection scope investigation](09-future-collection-scope.md) now precedes
first-increment selection. Scraper investigates existing code/captures for additional
meaningful information; Virgilio evaluates consultation value and records coordination.
Any fresh Citius access is a separate explicit step. No collection or implementation
is authorized by this investigation. The earlier retained-data scope remains input.

The offline investigation is complete and the consumer/source priorities are aligned,
paired with scraper 127463a8e9e4e1e4358af810df646ecefd9c10f7. Findings and the narrow
future-access decision are recorded in the scope document. No live access was performed.

## Scraper detour received: return to consumer and delivery planning

The [handoff assessment](10-scraper-extension-handoff.md) supersedes the earlier pending
live-access status. Read scraper c6956c2b07cdbb0aacbc9df87113de6e9d8cbcf3 with its pinned
implementation/results reports. Bounded scraper development and validation were explicitly
authorized there; no Virgilio runtime work or import is authorized. Next: candidate R3
evidence/dependency inventory and participant exposure decisions, coordinated with R4/R5.

The user's subsequent direction is to reevaluate what the scraper should collect using
the new findings before fixing delivery requirements. The handoff assessment records
a revised candidate scope, separating collection, preservation, interpretation and
consultation exposure; it also identifies future binary-refresh policy as an explicit
R4 decision. No further capture or implementation is started by this planning step.

## Revised collection matrix coordinated

The [revised scope matrix](11-revised-collection-scope.md) separates observation/acquisition,
original preservation, structured interpretation and proposed consultation exposure.
It includes site download locators as distinct from acquisition events and saved bytes.
User decisions remain original-response scope, binary assurance/context coverage and
participant interpretation/exposure. Scope precedes detailed R3 work; no live actions.

## First collection-scope choice agreed

The user agreed that the scraper should retain capturable source responses for the
discussed cases/acts/documents/participants and separate acquisitions. Recorded in
[decision 1](11-revised-collection-scope.md); sent to the scraper for alignment.
This is preservation scope, not development/full-contract acceptance. Continue with
binary refresh and participant exposure; R3–R5 remain open.

## Normal operating focus agreed

The user confirmed routine collection should target differences in open cases. The
[scope record](11-revised-collection-scope.md) records decision 2's direction, optional
broader checks and separate listing/binary coverage. Detailed R4 policy and participant
exposure remain open. No schedule, automatic trigger, scrape or development authorized.

## Participant direction agreed

The user agreed to structure reported names/designations and observation context, retaining
all participant occurrences and other source fields without automatic person merging or
unestablished relationship interpretation. [Decision 3](11-revised-collection-scope.md)
completes the three high-level scope directions; detailed R3–R5 remain open. Proceed to
concrete delivery/dependency planning under that scope, not implementation or import.

## Response preservation before delivery design

The user corrected the sequence and explicitly authorized coordinating a bounded
[intermediate scraper development slice](12-response-preservation-development.md).
Inspect existing samples, preserve case/act responses, validate a bounded collection,
then assess actual evidence before fixing R3 delivery requirements. The prior next-step
recommendation to proceed directly to delivery design is superseded. No Virgilio
runtime/import work is authorized; R3–R5 remain open.

Scraper implementation received at 537bdfa34626e9755cda50bab8a1cb2df5de9cde:
35 offline tests passed; bounded live validation stopped at login without source data.
The development record distinguishes committed implementation from pending live validation
and prior sample captures. Sign-in and the already authorized bounded check precede final
response assessment/delivery design. Virgilio remains documentation-only.

## Existing-response usefulness analysis precedes fresh validation

The user asked to analyse the saved responses first. The [direct analysis](13-retained-response-usefulness.md)
examines six case entries, fifteen acts/39 nested document appearances and 21 participant
entries with recomputed source hashes. These earlier originals can inform field choices
without renewed authentication; the preservation module's live check remains a separate
validation need. No new collection or implementation was performed.

## Source preparation ownership clarified

The user assigned source-material preparation to the scraper; Virgilio consumes the agreed
format. [Responsibility clarification](13-retained-response-usefulness.md) separates source
parsing/normalization from adapter-to-VIEC mapping and broker acceptance. Original-response
preservation/custody remains intact. Continue by agreeing producer output semantics and
consumer requirements, not duplicating Citius parsing within Virgilio.

## Producer-prepared exchange coordination

The user asked to coordinate scraper work under the clarified ownership boundary.
The [producer format coordination](14-scraper-prepared-exchange.md) requests a concrete
normalized/versioned draft with synthetic examples and implementation gaps. Review
consumer adequacy before new preparation/output implementation. No live source access,
normalization implementation or import is authorized by this planning slice.

Producer draft received at scraper 25bce3d84e700e3ce738c44925554471bd99bc5d;
consumer adequacy review recorded in the coordination document. Source preparation is
scraper-owned; no material foundation contradiction found. Format agreement, complete
fixtures and detailed R3–R5 decisions precede new normalized-output implementation.
