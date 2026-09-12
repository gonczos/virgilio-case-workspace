# Virgilio Consultation 2.0.0 beta — semantic planning baseline

Status: accepted by the user on 2026-09-12 as the semantic foundation for continued
planning only. Not implemented. Complete contracts and implementation readiness are
not accepted. Development remains unauthorized.

## Acceptance and exact scope

After joint drafting and independent review, the user agreed to accept the reviewed
semantic foundation as the planning baseline, with R3–R5 open and planning only.
This document deliberately promotes that bounded foundation from discussion into
accepted future-design guidance. It does not promote every detail of the drafts.

Accepted foundation inputs:

- Virgilio a1051bc94a6180652483e1e7f5fd62ba875b8690: VIEC and Citius integration
  proposals, planning revision 3.
- Scraper 8a046a37fabe1cace268ed40e0ad4be944f94f57: Citius–Scraper proposal and joint
  decision record, revision 4.
- Focused independent verification: review commit
  8fd9f6b14176b806b49d48275e9012b45b94acfd, R1/R2 verified resolved in those inputs.

The accepted scope is evidence-history preservation, scoped observations/acquisitions,
provider-independent VIEC and its Citius integration boundary, adapter mapping
provenance, broker final acceptance authority, exact-input comparison applicability,
and reviewed custody/retention obligations. Final contract version numbers are not
assigned by this acceptance. It does not commit to a scraper 0.3.0 release.

## Evidence foundation

External providers report evidence; their assertions are not unquestionable truth.
Preserve what was observed, the bytes obtained, and observed relationships with their
source, collection context and available times. Differences add observations rather
than silently replacing earlier evidence. Source events, interpretations, inferences,
adapter mappings and explicit corrections remain distinguishable.

Distinct collection events may yield identical bytes. Deduplicating physical content
must not collapse their observations. Replay of the same event-scoped evidence must
not invent an observation or acquisition. Binary identity is independent of packaging
and storage location. Preserve historical inputs and attributed correction lineage.

Listings and acquisitions are separate. Acquiring binary Y through case A does not
establish an acquisition or observed change in uncollected case B, even when they share
a token or description variant. Inferred reuse stays labelled as inference. Partial
coverage, unresolved matching and missing baseline evidence must not manufacture
absence or source novelty. Practical grouping does not establish a court relationship.

## Responsibilities and provider independence

VIEC is the Virgilio Evidence Ingestion Contract, independent of Citius. The Virgilio
Evidence Broker is the proposed component enforcing it. A provider adapter interprets
and maps a provider-specific exchange; the Citius Scraper Adapter is the first integration.
The Citius–Scraper contract remains upstream. Other providers may deliver events or
exports without being required to invent scrape snapshots, buckets or Citius tokens.

The adapter validates the provider exchange and its mapping. The broker owns final
VIEC acceptance; adapter success and incomplete receipt are not accepted evidence.
Mapped outputs retain exact upstream inputs/revisions, mapping rule/version identity
and relevant configuration. A corrected mapping is attributed to the mapping layer,
not represented as a scraper correction or new court event.

## R1 — Comparisons remain tied to exact inputs

Comparisons apply only to declared evidence, interpretation, coverage and relevant
mapping revisions. Supersession preserves historical results without transferring
applicability to successor inputs. Applying conclusions to different inputs requires
an explicit attributed derivation identifying them and its justification. Where no
applicable comparison exists for selected revisions, declare that condition separately
from a supplied not-assessed result. Immediate recalculation is not required.

Scraper comparisons identify exact dependencies/supersession. Adapters preserve those
and mapping revisions. The broker/Virgilio prevents silent application to other inputs.

## R2 — Custody, retention and retrieval

Required evidence must have an explicit custodian and durable resolution commitment.
For the first Citius integration, Virgilio retains required accepted material under
its own custody before broker acceptance, with identity, integrity and dependencies
validated. Previously accepted dependencies may be reused. Preserve original scraper
assertions consumed by mappings, rather than only the transformed output.

Required material supports inspection of claims, provenance and derivations: relevant
original binaries/captures, assertion payloads and collection context, exact revision
inputs/results, correction and mapping lineage, and retained applicable rule definitions.
Missing required material cannot silently become optional to pass acceptance. Failed
acquisition does not require a successful binary or fabricated failure artifact.
Explicit legacy/reference-only limitations do not satisfy required-material obligations.

Preservation enables inspection of historical results, retained inputs, rules and
lineage. It does not automatically guarantee executable replay or identical rerun
results; those require separate explicit commitments.

No automatic expiry applies to required material in the first increment. Disposal
requires a separate decision. Broker acceptance records Virgilio custody after retention
and validation. Later custody transfer requires verified access/integrity, receiving
custodian acknowledgement and traceable responsibility/resolution changes before
release of the preceding commitment. Transfer or acceptance never authorizes upstream
deletion or releases the scraper's independent retention obligation.

Custodians record detected unavailability, affected material and inspection limits,
attempt recovery under an agreed policy and report impact to the broker. Preserve
historical acceptance separately from current accessibility; do not silently substitute
content. Operational recovery targets and detection mechanisms remain to be planned.
Generic VIEC may allow explicitly agreed external custody for other integrations.

## Open planning and implementation boundary

| Decision | Owner | Still open |
| --- | --- | --- |
| R3 Acceptance conformance | Virgilio leads; scraper agrees exchange profile | Delivery units, required/optional contents, dependency closure, identity comparison boundaries and retry examples |
| R4 Coverage/matching | Scraper; adapter validates supported policies | Matching, normalization, completion criteria, baselines, resume limits and evidence supporting classifications |
| R5 Revision resolution | Joint | Scoped authority, competing/late branches, references, cycles and resolution validation |

No API transport, schema/migration, worker/service, storage implementation, runtime
prerequisite, processing, scrape, import, deployment or release is authorized by this
baseline. Existing implementation documentation continues to describe current behavior;
this accepted future-design foundation does not claim that existing upserts already
satisfy it. Subsequent changes to this foundation require explicit recorded decisions.

## Supporting planning records

- [Planning entry point](../discussions/virgilio-consultation-2.0.0-beta/README.md)
- [Resolution tracker](../discussions/virgilio-consultation-2.0.0-beta/review/03-resolution-tracker.md)
- [Focused review result](../discussions/virgilio-consultation-2.0.0-beta/review/06-follow-up-result.md)

Next planning slice: define R3's delivery/acceptance semantics in reviewable examples,
coordinate with the scraper profile, and retain R4/R5 as owned open decisions. No
further development scope is inferred from semantic acceptance.
