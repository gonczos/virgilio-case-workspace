# Joint review resolution tracker

Status: proposed resolutions, 2026-09-12. Neither contract is accepted.
This is the shared planning decision record, maintained in Virgilio. Each project
owns amendments to its own draft. Contract drafts remain unchanged by this entry.

Review baseline: 9b58b9c (report commit). Reviewed inputs remain Virgilio
 da7948d9279f7a6209dcf027c7c85781076901c1 and scraper
8f6b1b7e42406387d38040e6b652def5ae706153.

Process: open -> proposed resolution -> jointly agreed -> verified by follow-up review.
Verification of a finding is not contract acceptance or development authorization.
The same reviewer should inspect both revised checkpoints after joint agreement.

## Status register

| Finding | Status | Owner | Next action |
| --- | --- | --- | --- |
| R1 Comparison applicability | Proposed resolution | Joint | Agree wording, amend each draft, obtain paired commits |
| R2 Evidence custody and retrieval | Proposed resolution | Joint | Decide required categories, custodians, retention and transfer/failure rules |
| R3 Acceptance conformance | Open; before implementation | Virgilio leads, scraper agrees profile | Define delivery unit and dependencies |
| R4 Coverage/matching policies | Open; before implementation | Scraper, adapter validates support | Define versioned policy and limits |
| R5 Revision-resolution scope | Open; before implementation | Joint | Define scope, authority and late-branch behavior |

## Scraper-supplied R1 proposal

The user relayed the following scraper-side wording after reading review commit
9b58b9c. It is a proposal, not an agreed amendment:

> A comparison applies only to its declared input revisions, including evidence, interpretations, coverage assessments and any adapter mappings it depends on.
>
> Superseding an input preserves the comparison as a historical derivation. It does not automatically establish applicability to the successor. Applying its conclusions to different inputs requires an explicit, attributed derivation identifying those inputs and its justification.
>
> Where no applicable comparison exists for the selected revisions, declare that absence of a comparison. Do not silently retain an earlier conclusion as a conclusion about corrected evidence. Immediate recalculation is not required.

Example: C1 remains the historical absence result using A1. If A2 establishes
incomplete coverage, C1 cannot support an absence claim over A2.

Proposed responsibilities:

- Scraper: exact comparison dependencies and correction/supersession relationships.
- Adapter: preserve those dependencies and identify mapping revisions separately.
- Broker/Virgilio: retain historical results and prevent silent application to
  different selected revisions.

Virgilio planning response: suitable for joint agreement without further conceptual
change. The availability of a comparison for selected inputs is distinct from a
comparison result saying not assessed. This entry does not itself declare agreement.

## Scraper-supplied R2 proposal

> Material required to inspect delivered evidence and reproduce its declared interpretations or mappings must have an explicit preservation custodian and a durable resolution commitment.
>
> Acceptance must establish that required material is retrievable under that commitment, whether held by Virgilio or an agreed external custodian. A transient path alone is insufficient.
>
> Legitimate relocation changes resolution information, not evidence identity. Custody transfer must explicitly establish the receiving custodian's responsibility and verified access before releasing the preceding obligation.
>
> If material later becomes unavailable, preserve the accepted evidence and history, record the availability failure, and identify the affected inspection or reconstruction capabilities. Do not silently substitute content or represent unavailable material as retrievable.

Distinguish preserved/retrievable, previously available/now unavailable and reference-only
material never supplied or held under a commitment. Explicitly unavailable optional or
legacy material may remain represented but cannot satisfy a required-material obligation.

Scraper's stated capability boundary: it can take responsibility for retaining original
collection evidence and exposing stable identities. Its current local storage does not
establish permanent downstream availability. This is a relayed position, not a new
operational guarantee verified or accepted by Virgilio.

## R2 decisions still needed

1. Required material: which artifacts, original delivered assertions, context,
   binaries, interpretation definitions and mapping definitions are necessary for
   inspection and reconstruction? Preserve original scraper assertions used by mappings.
2. Custody and duration: who owns each material category after acceptance, with what
   retention duration and explicit rules for any end of obligation?
3. Transfer and failure: what verifies transfer, who records resolution updates and
   unavailability, and which capabilities become unavailable?
4. Meaning of reproduction: distinguish inspecting the historical result and its exact
   inputs/rules from guaranteeing re-execution of an entire historical runtime. Do not
   introduce an unsupported reproducibility guarantee through the preservation clause.

Virgilio-side discussion proposal (not agreed): for the first integration, Virgilio
could hold the required accepted evidence and mapping-input material under its own
preservation responsibility, avoiding a dependency on permanent scraper availability.
The scraper's retention of original collection evidence remains a separate obligation;
copying material downstream must not silently authorize upstream deletion. VIEC can
still permit explicitly agreed external custodians for other integrations. Deduplicated
physical storage is compatible with preserving distinct observations and provenance.
No storage design, retention duration or deletion/transfer policy is selected here.

## Coordination boundary

Next message to scraper should seek agreement on R1 and discuss the R2 custody choices,
not claim either finding closed. Each project then amends its draft and returns an exact
commit. Record those paired inputs and request bounded R1/R2 follow-up review. Preserve
R3–R5 as separate planning decisions. No runtime changes are part of this process.
