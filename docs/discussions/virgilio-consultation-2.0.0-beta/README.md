# Virgilio Consultation 2.0.0 beta — Planning

Status: semantic foundation accepted for planning on 2026-09-12. R3–R5 open; development unauthorized.

The user named this phase Virgilio Consultation 2.0.0 beta and agreed that
submodules and contracts should have independent versions. This is a planning
milestone, not a released version, development authorization or a package version bump.
Use Virgilio rather than VC in new discussion and documentation.

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
