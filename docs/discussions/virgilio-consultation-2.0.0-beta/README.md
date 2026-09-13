# Virgilio Consultation 2.0.0 beta — Planning

Status: semantic foundation accepted for planning on 2026-09-12. R3–R5 open; Virgilio development unauthorized. Bounded scraper development is separately authorized as recorded below.

The user named this phase Virgilio Consultation 2.0.0 beta and agreed that
submodules and contracts should have independent versions. This is a planning
milestone, not a released version, development authorization or a package version bump.
Use Virgilio rather than VC in new discussion and documentation.

## Current planning slice

Current decision proposal: [R3 delivery and acceptance table](16-r3-delivery-and-acceptance.md),
covering base evidence, replay, correction, supplement and listed-unacquired media.
Bounded independent sample verification is complete; joint feasibility and user decisions
on these acceptance proposals remain pending.

Latest: [resumed output-sample consumer review](15-output-sample-consumer-review.md)
checks the concrete fixtures and identifies bounded follow-ups for digest states,
listed-unacquired media and contradictory source status. Media download support is
not a blocker for this phase. Format agreement and independent follow-up remain pending.

[Evidence availability and consultation needs](05-evidence-and-consultation-planning.md)
comes before detailed R3 delivery/acceptance planning. The
[scraper inventory handoff](prompts/01-scraper-evidence-inventory.md) is saved;
the inventory is received and [consultation implications](06-consultation-implications.md)
are recorded as proposals. The user has specified
[connected consultation views and ingestion management](07-consultation-and-ingestion-management.md).
The [future collection investigation](09-future-collection-scope.md) led to a separately authorized scraper extension and completed validation. The [scraper handoff assessment](10-scraper-extension-handoff.md) records current results and proposed consumer/delivery decisions. The [revised collection-scope matrix](11-revised-collection-scope.md) coordinates that reevaluation before fixing R3 delivery requirements. The three high-level directions are agreed: preserve capturable collection responses, normally target differences in open cases, and structure participants as reported without automatic identity resolution. The user subsequently authorized [intermediate scraper response-preservation development](12-response-preservation-development.md), to inspect actual retained responses before delivery design. The [retained-response usefulness analysis](13-retained-response-usefulness.md) informs consumer requirements independently of the remaining live validation. The scraper owns source parsing/normalization; the [producer-prepared exchange draft](14-scraper-prepared-exchange.md) is now being coordinated. Virgilio validates the agreed exchange, maps it to VIEC and enforces acceptance/preservation. Detailed R3–R5 and all Virgilio implementation/import work remain open or unauthorized.

## Start here

- [Accepted semantic planning baseline](../../architecture/24-virgilio-2-semantic-planning-baseline.md)

- [Decisions, boundaries and versions](01-decisions-and-versions.md)
- [VIEC: provider-independent contract proposal](02-viec-proposal.md)
- [Citius scraper integration and upstream contract](03-citius-integration-proposal.md)
- [Joint review scenarios and open decisions](04-review-and-next-steps.md)
- [Independent joint review findings](review/02-findings.md)
- [Joint review resolution tracker](review/03-resolution-tracker.md)
- [Focused R1/R2 follow-up result](review/06-follow-up-result.md)
- [Supplied source reports and drafts](sources/README.md)

## Purpose

Plan Versioned Court Evidence Ingestion as a Virgilio-side capability, with
VIEC (Virgilio Evidence Ingestion Contract) independent of Citius. The Citius
Scraper Adapter is the first integration. Future providers or a direct Citius
API should connect through their own mappings without inventing scrape semantics.
The scope of the rest of 2.0.0 beta has not yet been established.

## Status and authority

The user accepted the reviewed semantic foundation as the planning baseline.
Its bounded authority is recorded in the architecture document linked above;
other draft details remain proposals.
Neither complete contract is accepted. An independent joint review of the pinned drafts is recorded
under review/. Follow-up verified R1/R2 resolved in the pinned drafts; R3–R5 remain open.
These reviews do not authorize implementation. No implementation,
API transport, schema, migration, scrape or import is authorized by these files.
Current architecture remains under ../../architecture/ and setup remains in
../../SETUP.md. These proposals must not silently override either.

The documents consolidate the September 11–12 conversation and supplied scraper
reports. They are not a verbatim conversation transcript. Historical inputs are
retained under sources/; their reports of scraper implementation are attributed,
not independently verified in this project.

## Maintenance

Keep this index as the entry point. Record new decisions and unresolved questions
in the appropriate document; keep historical inputs unchanged. Use Git commits
for draft history. Before independent review, identify the exact commit and
contract draft revisions. After review and explicit acceptance, deliberately
promote settled architecture to its authoritative location. Contract acceptance,
implementation readiness and application release are separate milestones.
