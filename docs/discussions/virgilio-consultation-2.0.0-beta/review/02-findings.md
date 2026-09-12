# Independent joint review — findings

Date: 2026-09-12. Reviewer: joint_contract_review AI subagent, independent of draft
authorship but given discussion context; not a blind review or human certification.
This document preserves the review findings in a structured report prepared by the
coordinator from the returned reviewer response. It is not a verbatim transcript.
No findings have been adopted as contract amendments by recording them here.

## Inputs and method

- Virgilio: da7948d9279f7a6209dcf027c7c85781076901c1. Planning README, decisions/version
  register, VIEC revision 2, Citius integration revision 2 and review brief.
- Scraper: 8f6b1b7e42406387d38040e6b652def5ae706153. Citius–Scraper proposal revision 3,
  joint decisions/review revision 3 and implementation grounding.

Reviewer used git show at these commits. The references below are path:line locations
in those pinned versions, not necessarily the current checkout. No files, commits,
database operations, scrapes, imports or runtime tests were performed by the reviewer.

Reference abbreviations:

- VIEC: Virgilio docs/discussions/virgilio-consultation-2.0.0-beta/02-viec-proposal.md
- Integration: same directory, 03-citius-integration-proposal.md
- Upstream: scraper docs/20-roadmap/phase-04-evidence-contracts/citius-scraper-contract-proposal.md

## Verdict

The pinned proposals are coherent and preserve the separation between source evidence,
scraper interpretation, adapter mapping and broker acceptance. No substantive
cross-project contradiction was found. Resolve two semantic obligations before contract
acceptance, then the explicitly open operational details before implementation.
This is a recommendation, not contract approval.

## R1 — Comparisons after input supersession

Priority: high. Recommended resolution before contract acceptance.
Owner: joint; scraper supplies revision relationships, Virgilio preserves applicability.

Exact comparison inputs and earlier results are preserved, and corrections may arrive
without replacement comparisons. Applicability of the older comparison to proposed
current evidence is not explicitly addressed for that combination.

Scenario: C1 concludes a document is absent using coverage assessment A1. Correction
A2 says the listing was incomplete. No replacement comparison has arrived. C1 remains
a historical result over A1 but must not silently remain a current absence claim over
A2. Corrected adapter mappings raise the same concern.

References: Upstream:40 (coverage correction), :72 (comparison inputs); VIEC:36
(supersession), :46 (delayed comparisons), :70 (mapping corrections).

Resolution direction: preserve C1 against its exact historical inputs. Do not promote
or rebind it to corrected inputs without an attributed derivation establishing that
applicability. Declare when no comparison exists for selected revisions. No immediate
recalculation, deletion or particular UI is required. This is a missing explicit rule,
not a contradiction or a claim that historical results become false merely because an
input has a successor.

## R2 — Retention and resolution behind upstream references

Priority: high. Recommended resolution before contract acceptance.
Owner: joint; broker and scraper need an explicit custody boundary.

The proposals preserve evidence and the scraper retains artifacts. The exchange allows
artifact references and exact mapping inputs without specifying durable resolution after
acceptance, responsibility for it, or the meaning of lost availability.

Scenario: broker accepts mapped observations after artifacts are validated in a local
scraper package. That package is later relocated or removed. IDs and mapping versions
remain, but the original delivered assertions/artifacts cannot be retrieved to inspect
or correct the mapping. Identity lineage survives without practical reconstruction.

References: Upstream:119 (retention); Integration:67 (artifact references); VIEC:28
(identity versus locators), :39 (acceptance dependencies), :67 (mapping lineage).

Resolution direction: define required evidence retrievability, preservation ownership
and resolution across legitimate relocation. Distinguish preserved content from a
reference-only assertion whose material is unavailable or was never supplied.
This does not mandate copying every artifact to Virgilio or a new storage service.
Canonical binary immutability already exists as repository policy; durable resolution
across the boundary is a different obligation. The missing guarantee is the concern,
not the absence of a mandatory physical copy.

## R3 — Acceptance conformance

Priority: medium. Already acknowledged decision before implementation, not a newly
found contradiction. Owner: Virgilio leads; scraper agrees the exchange profile.

Define the declared unit and dependency closure, required versus optional material,
and immutable identity comparison boundaries for the first profile.

Scenario: a delivery includes a snapshot and a supplement but lacks one required
artifact. Implementations might disagree whether the snapshot is independently
acceptable or the whole delivery must remain unaccepted. All-or-nothing acceptance is
sound; its unit boundary must be explicit.

References: VIEC:39, :76; Integration:84.

Resolution direction: a small normative manifest/profile with incomplete receipt,
previously accepted dependencies, identity conflict, commit followed by lost
acknowledgement and retry examples. Adapter success remains separate from broker
acceptance; this ownership is already correctly specified.

## R4 — Concrete coverage and matching policies

Priority: medium. Already acknowledged decision before implementation.
Owner: scraper; adapter validates declared policy support.

Completion, matching, normalization, baseline selection and resume limits must become
identified policies or conservatively yield not assessed.

Scenario: listing order changes during pagination. All requests succeed but an item
slips between pages. Request success alone cannot justify absent. Equal descriptions
also must not force a permanent-identity match.

References: Upstream:26, :34, :76, :143.

Resolution direction: identify the applied policy, coverage evidence and limits.
Do not demand an imaginary simultaneous Citius state; define what interval collection
can establish and withhold unsupported classifications. A versioned Citius policy annex
can hold this without introducing Citius rules into VIEC.

## R5 — Revision-resolution scope and validation

Priority: medium. Already acknowledged decision before implementation. Owner: joint.

Explicit supersession, attributed resolution and no arrival-order winner are sound.
Define the lineage a resolution covers, its authority and reference validation.

Scenario: interpretations branch from R1. A resolution selects R2. A previously unseen
competing branch then arrives. One consumer might treat the selection as permanent;
another might regard the new branch as unresolved.

References: VIEC:36; Integration:86, :98.

Resolution direction: exact scoped targets and resolution basis, avoiding ambiguous
cross-lineage supersession and cycles. Keep scraper interpretation, adapter mapping
and Virgilio preference lineages separate. Encoding remains an implementation choice.

## Scenario coverage

| Scenario group | Result |
| --- | --- |
| Fresh identical collection/replay | Clear; deduplicated bytes do not merge events |
| A obtains Y; B unobserved | Clear; no invented B acquisition or change |
| Representative retrieval | Valid strategy with inferred reuse distinguished |
| Metadata/membership/binaries | Dimensions distinct; parent summaries cannot overclaim |
| Partial scope/absence | Sound; concrete policy remains R4 |
| Parser/coverage/mapping correction | Separate lineages clear; delayed comparison applicability is R1 |
| Historical supplements | Supported attribution distinct from unresolved provenance |
| Adapter success/broker rejection | Final acceptance authority unambiguous |
| Incomplete delivery/retry | Sound; conformance boundary is R3 |
| Repackaging/relocation | Not evidence-identity change; continued resolution is R2 |
| Conflicting revisions | Sound direction; late-branch scope is R5 |
| Delayed comparisons | Exact inputs required; R1 prevents silent application to newer inputs |
| Legacy material/grouping | Unknowns preserved; no invented court relationship |
| Event provider/future Citius API | No required Citius snapshots, buckets or tokens; no structural coupling defect found |

## Implementation spot-checks and limitations

At the pinned commits the reviewer independently checked:

- Scraper scripts/node/tribunais-ingest-sqlserver.mjs:368: run reset deletes
  observation rows.
- Scraper scripts/node/tribunais-build-portable-case-package.mjs:432: binary-link
  export joins global document/binary associations through membership without a
  case-scoped acquisition join.
- Virgilio app/import-package.mjs:1312 and following: incoming values replace existing
  binary storage, integrity and readability fields.

These support structural risks, not proof of a specific lost historical observation
or actual A-to-B binary change. Other grounding claims remained attributed reports;
this was not a complete implementation audit, historical recovery investigation or
runtime validation. There were no optional architectural redesign recommendations.

## Recommended follow-up

Resolve R1 and R2 jointly in draft language. Track R3–R5 as implementation-readiness
decisions with owners. Return revised clauses for bounded follow-up review. Do not
interpret this report as either contract's acceptance, a release commitment or
implementation authorization. All five findings remain open at report creation.
