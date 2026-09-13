# R3: delivery and acceptance decision table

Recorded 2026-09-13. Proposed positions for joint review and user decision, not accepted
contract clauses, a schema or development authorization.

Basis: the accepted [semantic foundation](../../architecture/24-virgilio-2-semantic-planning-baseline.md),
[consumer review](15-output-sample-consumer-review.md), scraper fixtures at
de2a8424557fd5204cfce73186f2d331b4051ede and independent follow-up/dispositions at
06c70c048b3ce48cdc53fd82217832fada00603c. Original findings 1/2 and the three consumer
follow-ups are verified addressed for their demonstrated scope, not a complete format.
Historical manifest attribution remains qualified; checker coverage is bounded.

## Proposed common acceptance boundary

A delivery declares one or more explicitly identified units with fixed contents and exact
dependencies. Each unit is accepted as a whole; material merely received is not partially
promoted as accepted evidence. Separately declared units can be accepted independently
once their own dependencies qualify. The broker must not silently split a defective unit
to make it acceptable. Unit size (case, collection or another scope) is declared by the
profile, not inferred from transport files. The examples below propose logical units;
they do not require one physical archive per unit or fix a universal unit size.

Required support can arrive in this delivery or already be accepted and retained under
Virgilio custody. Before new acceptance, establish exact identity, integrity, current
retrievability and dependency closure. An earlier acceptance alone does not establish
continued availability. Required originals, producer assertions, applicable rules and
adapter mapping lineage remain preserved; raw Citius parsing stays scraper-owned.

Evidence may arrive without a comparison if comparison availability is explicit. A supplied
comparison requires its exact evidence/interpretation/coverage/mapping inputs as applicable.
Acceptance means faithful, supported ingestion, not endorsement of court assertions.

## Proposed decision table

| Example / proposed unit | Required contents and dependencies | Broker acceptance / limitation |
| --- | --- | --- |
| Base evidence | Finalized collection identity and declared known coverage; scoped observations, prepared assertions, projection accounting and applicable rules; exact originals/context supporting those claims. Acquisition claims include retained responses and measured bytes where actually obtained. Preserve delivered assertion bytes and adapter mapping lineage. | Accept when the declared unit and required support are validated and retained. Partial collection or documented normalization failures do not by themselves make the delivery incomplete: the unit must faithfully account for its declared scope. Finalization does not imply successful or full collection. |
| Replay | Declared replay identity and exact references to previously accepted assertion/event revisions. A new wrapper or storage path is not a new source event. | Validate identity consistency and dependency availability; record receipt/replay outcome without duplicating evidence or acquisitions. Conflicting content/provenance under an immutable identity cannot be accepted as a replay. Never-accepted evidence uses ordinary acceptance checks. |
| Producer interpretation correction | New attributed revision, reason, exact predecessor/input/rule references, replacement outputs and affected scope; retain old assertions. Unchanged material may be reused through accepted dependencies. | Accept the correction as an additional historical revision when supported. Do not rewrite old evidence, fabricate collection or transfer old comparison conclusions to corrected inputs. A broker/adapter mapping correction has its own attribution; it is not a scraper correction. Current-revision selection remains subject to R5. |
| Historical supplement | New delivery/revision identity, exact historical event attribution, added assertions/materials and any revised membership/coverage with reasons and prior references. | Accept supported additions and scoped revisions while retaining initial history. Unresolved attribution cannot expand established snapshot membership or coverage. A separately declared limited assertion may preserve that uncertainty, but does not satisfy a unit claiming verified historical membership. |
| Listed-unacquired media | Supported listing metadata, explicit source-digest state, references and acquisition status/limitation. Retained player HTML and attempt evidence are required where used to support delivered claims; any HTML measurements identify that HTML only. | Accept the supported listing/limitation without requiring an unacquired media file. No actual-media binary identity, measured media size/hash or acquisition success is invented. An unattempted item must not acquire a fictitious failed attempt. This implements the user's phase boundary without waiving support for claims actually delivered. |

## Proposed receipt outcomes

- **Accepted:** declared unit meets applicable exchange and VIEC requirements; required
  support is retained and validated. The broker owns final acceptance; adapter validation
  success alone does not grant it.
- **Incomplete:** required contents/dependencies or validation are still pending. Record
  what was received and what is missing; expose no new accepted evidence from that unit.
  A later receipt can complete it without inventing source events.
- **Rejected attempt:** a demonstrated violation prevents accepting the proposed unit,
  such as an unsupported contract version, immutable-identity conflict or invalid evidence
  attribution. Preserve the reason and receipt history. This does not delete earlier accepted
  evidence or rule out a corrected future submission. A damaged transport copy requires
  verified retransmission, not relabelling the source evidence itself as changed.

These are proposed acceptance outcomes, not a complete workflow/UI or database model.
Competing well-formed revisions are not automatically immutable-identity conflicts;
their preservation and selection rules remain explicit R5 questions.

## Decisions to take after scraper feasibility review

1. Agree declared whole-unit acceptance with exact reusable dependencies, and whether the
   proposed logical examples provide sufficient initial granularity without mandatory
   case-wide or collection-wide grouping.
2. Agree required support by claim as above, including delivery of producer assertion
   bytes and preserved rules, with listed-unacquired media represented explicitly.
3. Agree the receipt-outcome distinctions; resolve remaining legacy/support exceptions
   explicitly instead of weakening required dependencies to get acceptance.

Scraper checks whether these requirements can be expressed faithfully by the reviewed
examples and identifies concrete gaps. R4 retains normalization/matching/coverage policy;
R5 retains revision authority, conflicts and selection. This table does not resolve them,
accept a complete output format, choose API versus package transport or authorize work
on a normalizer, adapter, broker, import or media acquisition.
