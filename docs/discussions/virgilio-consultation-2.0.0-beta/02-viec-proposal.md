# VIEC — Virgilio Evidence Ingestion Contract

Status: 1.0.0-draft proposal, planning revision 3, 2026-09-12.
Not accepted or implemented. Revision 2 was independently reviewed; the R1/R2
wording in revision 3 is jointly agreed for the draft, pending focused verification.

## Boundary

A provider exposes data under its own contract. A provider adapter maps that
contract to VIEC while preserving meaning, context and limitations. Virgilio
accepts evidence and attributed derivations and builds consultation views.

VIEC does not require Citius cases, buckets, retrieval tokens, scrape windows or
full snapshots. A provider may expose events, periodic exports or other evidence
units. Provider-specific profiles must declare their scope and coverage semantics.
Do not invent completeness or collection events to fit a generic structure.

## Proposed core obligations

1. Identify the provider and source, provider contract and exchange version,
   evidence identities and their scope. Preserve the distinction between the
   external source and the intermediary that collected or interpreted its data.
2. Distinguish observations, artifacts, acquisitions, immutable binaries,
   interpretations, relationships and derivations when supplied. Preserve each
   relationship's origin, actual observation context and supporting evidence.
3. Distinguish event identity from byte identity and delivery identity. A fresh
   collection may return identical content. Replay of the same event-scoped evidence
   creates no source event. Legacy uncertainty must remain explicit.
4. An immutable evidence identity cannot silently acquire different defined content
   or provenance. Packaging and storage locators are separate operational details.
   Corrections have explicit revision identity and lineage.
5. Preserve earlier accepted states. Corrections, evidence supplements and revised
   coverage assessments reference their affected evidence and explain their basis.
   Unknown historical attribution cannot establish collection membership or coverage.
6. Keep observation, discovery, processing, correction and delivery times distinct.
   Preserve unknown timestamps. Arrival order is not evidence chronology.
7. Explicit supersession identifies a proposed current interpretation. Competing
   branches remain unresolved until an attributed resolution identifies its selection
   and basis. Virgilio annotations/preferences do not become provider resolutions.
8. Declare each delivery unit's contents and dependencies. Accept only when required
   material is available and validated, including previously accepted dependencies.
   Material received during an incomplete attempt must not appear as accepted evidence.
   Retrying must not duplicate accepted evidence. Rejected attempts need diagnostics.
9. Delivery completeness and source coverage are independent. A complete delivery
   can faithfully describe an incomplete collection. Unsupported versions, unresolved
   dependencies and immutable identity conflicts prevent acceptance of the affected unit.
10. Evidence delivery need not wait for comparisons. Declare comparison availability:
    not supplied is different from a supplied not-assessed result. Later comparisons
    reference exact accepted evidence and interpretation revisions, rule versions,
    assessed dimensions, compatibility basis and reasons. Virgilio-produced derivations
    remain attributed to Virgilio.
11. Incremental delivery must make later corrections, supplements and comparisons
    discoverable even when they concern older collections. Collection dates alone
    cannot define ingestion progress.
12. Preserve legacy evidence with its known provenance and explicit limitations.
    No invented snapshot completeness, independent acquisitions or permanent source
    identities may be derived merely from old consolidated package keys.

## Validation and consultation

The adapter validates the provider exchange and its mapping to VIEC, including
supported versions, upstream identity/provenance, dependencies and content integrity.
The Virgilio Evidence Broker owns final VIEC acceptance and preservation enforcement.
Adapter success alone never means accepted evidence. The broker must establish that
the declared unit satisfies VIEC acceptance obligations before exposing it as accepted;
how validation results are reused internally remains an implementation decision.

Mapped evidence retains references to exact upstream input identities and revisions,
the adapter identity, and mapping-rule/version identity. Delivered source/provider
assertions remain distinguishable from adapter transformations and derivations.
A corrected mapping creates an attributed mapping revision with its prior lineage;
it is neither a scraper correction nor a new source observation or acquisition.

Faithful ingestion does not certify an external assertion as true. Consolidated
views retain lineage and must not silently replace the underlying evidence history.

Exact minimum required fields, acceptance granularity, compatibility rules and
representation of unresolved input remain review questions. This is a semantic
proposal, not a universal schema or a commitment to accept every provider immediately.

## First integration

See 03-citius-integration-proposal.md. Finalized-only snapshot delivery is that
profile's initial boundary, not a requirement that all VIEC providers scrape.
API versus portable package delivery, endpoints and database changes remain undecided.

## Receiving component

Virgilio Evidence Broker is the proposed name of the component receiving mapped
provider evidence and managing acceptance/preservation under VIEC. The broker is
a component; VIEC is its contract. No messaging infrastructure is implied or chosen.

## R1 — Applicability to exact revisions

A comparison applies only to its declared input revisions, including evidence,
interpretations, coverage assessments and any adapter mappings it depends on.
Superseding an input preserves the comparison as a historical derivation; it does
not automatically establish applicability to the successor. Applying its conclusions
to different inputs requires an explicit attributed derivation identifying those
inputs and its justification.

Where no applicable comparison exists for selected revisions, declare that absence
of a comparison. Do not silently retain an earlier conclusion as a conclusion about
corrected evidence. Immediate recalculation is not required. A missing comparison
is distinct from a supplied comparison whose result is not assessed.

Providers identify exact comparison dependencies and correction/supersession links.
Adapters preserve them and separately identify mapping revisions. The broker and
Virgilio preserve historical results and prevent silent application to other selected
revisions. For example, an absence result based on complete-listing assessment A1
remains historical when correction A2 declares incomplete coverage; it cannot support
an absence claim over A2 without a new justified derivation.

## R2 — Custody and continued retrieval

Material required to inspect accepted claims, establish provenance and understand
declared derivations must have an explicit preservation custodian and durable
resolution commitment. Acceptance establishes that required material is retrievable
under that commitment, whether held by Virgilio or an explicitly agreed external
custodian. A transient path alone is insufficient. The provider profile defines
required material; optional or limited legacy material must not silently satisfy a
required dependency. Previously accepted material may satisfy required dependencies.

Preservation supports inspection of historical results, their exact retained inputs,
applicable rules and lineage. This alone does not guarantee executable replay of old
software or identical rerun results. Any such guarantee separately identifies retained
implementation, configuration, runtime dependencies and known nondeterminism or
external dependencies. A mutable or unavailable rule-version reference is insufficient
where that rule definition is required to understand the accepted derivation.

Legitimate relocation changes resolution information, not evidence identity. Later
custody transfer requires explicit receiving-custodian acknowledgement, verified
access and integrity of required material, and traceable responsibility/resolution
updates before the preceding obligation is released. Transfer is not deletion
permission and does not release a separate upstream retention obligation.

Each custodian records detected availability failures and affected material, attempts
recovery under an agreed policy, and reports impact to the broker. The broker records
affected evidence/dependencies and inspection limits. Preserve historical acceptance
and earlier evidence history without implying continued accessibility, silently
substituting content or representing unavailable material as retrievable.

Distinguish preserved/retrievable, previously available but now unavailable, and
reference-only material never supplied or held under a preservation commitment.
Unknown availability remains explicit. Detection schedules, recovery objectives and
notification mechanisms are implementation-readiness decisions, not guarantees
established by this draft. The Citius integration proposal sets the first profile's custody/retention boundary; other providers need an explicit profile rather than an invented Citius model.
