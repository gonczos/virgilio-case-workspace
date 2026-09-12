# Joint review resolution tracker

Status: R1/R2 verified resolved in the paired draft checkpoints, 2026-09-12. Neither contract is accepted.
This is the shared planning decision record, maintained in Virgilio. Each project
owns amendments to its own draft. Earlier proposal entries are historical; the latest incorporation entry records current draft status.

Review baseline: 9b58b9c (report commit). Reviewed inputs remain Virgilio
 da7948d9279f7a6209dcf027c7c85781076901c1 and scraper
8f6b1b7e42406387d38040e6b652def5ae706153.

Process: open -> proposed resolution -> jointly agreed -> verified by follow-up review.
Verification of a finding is not contract acceptance or development authorization.
The same reviewer should inspect both revised checkpoints after joint agreement.

## Status register

| Finding | Status | Owner | Next action |
| --- | --- | --- | --- |
| R1 Comparison applicability | Verified resolved in reviewed drafts | Joint | Preserve verified wording; contract acceptance remains separate |
| R2 Evidence custody and retrieval | Verified resolved in reviewed drafts | Joint | Preserve verified wording; operational R3–R5 remain open |
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

## R2 refinement — required material and inspection

The user supplied the [scraper custody response](04-scraper-custody-response.txt),
attachment 4b0302ef-9b32-44fe-9eaf-8940a1a1491f/pasted-text.txt. The preserved copy
was checked byte-for-byte by SHA-256. It supports Virgilio custody for the first
integration and retains the independent upstream obligation. It remains a proposal.

Required material is that needed to inspect accepted claims, establish provenance
and understand derivations, not every incidental collection file:

- Exact obtained binary bytes and source captures/responses supporting accepted
  observations, interpretations or coverage, including available supporting failure artifacts.
- Original scraper assertions and their event identities, occurrences, acquisition
  attempts, request context, times, scope/coverage, gaps and exact revisions.
- Interpretation results, exact inputs, parser/rule/configuration identities,
  correction reasons and supersession lineage.
- Delivered comparison results, exact baseline/target and interpretation/coverage
  revisions, dimensions, reasons, compatibility basis and applicable rules.
- Adapter inputs, mapped results, rule/configuration identities and correction lineage.
- Retained identifiable rule definitions, not just labels pointing to mutable material.

Missing required bytes/assertions, integrity failures, unresolved required dependencies
or missing derivation basis block acceptance of the proposed unit. Already accepted
dependencies can be reused. Incidental diagnostics and unnecessary duplicate copies
can be optional. Legacy/reference-only limitations need explicit profile treatment;
required evidence must not silently become optional to pass acceptance. A failed
acquisition does not require a successful binary or an invented failure artifact.
Preserve available support for the actual attempt and outcome and its known limits.

The proposed guarantee is inspection of historical results, exact retained inputs,
rules and lineage. Executable replay and identical rerun results require a separate
explicit guarantee, including runtime, configuration and external/nondeterministic
limitations. Preserving every historical runtime is not automatically required.

## Proposed completion of remaining custody rules

The following are Virgilio-side suggestions for joint/user agreement, not amendments
or adopted policy:

1. Retention: first increment has no automatic expiry of required accepted evidence.
   Acceptance, successful transfer, software upgrade and comparison supersession do
   not trigger deletion. Any future retention/disposal policy requires an explicit
   separate decision. Do not promise permanent physical availability or set the
   scraper's independent retention period unilaterally.
2. Establishment: broker acceptance records Virgilio's custody commitment, after
   required content is retained and identity/integrity/dependencies are validated.
   Receipt/staging is not acceptance. Later transfer requires explicit receiving
   custodian acknowledgement, verified required-content access/integrity and traceable
   responsibility/resolution updates before the earlier commitment can be released.
   Transfer does not authorize deletion; upstream custody remains independent.
3. Unavailability: each custodian records detected failures affecting its material,
   attempts recovery under an agreed operational policy, and reports impact to the
   broker. The broker records affected evidence/dependencies and current availability,
   including limitations on inspection. Historical acceptance remains intact;
   unavailable content is not silently substituted or presented as retrievable.
   Detection schedules, recovery objectives and notification mechanisms remain open.

R1 and R2 remain proposed resolutions. Contract drafts are unchanged. R3–R5 remain
separate implementation-readiness decisions; these proposals do not select their
manifest schema, transaction boundaries, coverage policies or resolution encoding.

## Joint wording agreement and Virgilio incorporation

The user relayed the scraper-side agreement to no automatic expiry, acceptance-based
Virgilio custody after retention/validation, verified acknowledged transfer, and
recorded unavailability/recovery with historical acceptance preserved. The independent
scraper obligation remains intact and upstream deletion is not authorized. Together
with R1 exact-input applicability, this is agreement on draft wording only.

Virgilio incorporated that wording and the required-material/inspection clarification
into VIEC and the Citius integration proposal, planning revision 3. Earlier proposal
sections above are preserved as discussion history and do not override this status.
R1/R2 are jointly agreed for the draft, not verified closed or contract-accepted.
R3–R5 remain open implementation-readiness decisions.

The scraper reports no amendments saved yet. Next dependency: its amended upstream
commit. Pair it with the Git commit containing this revision-3 incorporation and ask
the same independent reviewer for a bounded R1/R2 follow-up. Do not review the old
upstream commit as if it already contains the new clauses. No development is authorized.

## Focused review verification

The scraper supplied amended revision 4 at 8a046a37fabe1cace268ed40e0ad4be944f94f57.
The same independent reviewer checked it with Virgilio revision 3 at
 a1051bc94a6180652483e1e7f5fd62ba875b8690. See the
[follow-up request](05-follow-up-request.md) and [result](06-follow-up-result.md).

R1 and R2 are verified resolved at the semantic draft level with no new contradiction
or regression found in scope. Earlier pending entries above are history, not the
current status. Neither contract is accepted; no implementation is authorized.
R3–R5 remain open implementation-readiness decisions with their existing owners.
