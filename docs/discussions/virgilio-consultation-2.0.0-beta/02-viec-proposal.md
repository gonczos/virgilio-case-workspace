# VIEC — Virgilio Evidence Ingestion Contract

Status: 1.0.0-draft proposal, planning revision 2, 2026-09-12.
Not accepted, independently reviewed or implemented.

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
