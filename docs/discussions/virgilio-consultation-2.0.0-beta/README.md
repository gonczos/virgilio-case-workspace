# Virgilio Consultation 2.0.0 beta — Planning

Status: open planning phase. Established 2026-09-12.

The user named this phase Virgilio Consultation 2.0.0 beta and agreed that
submodules and contracts should have independent versions. This is a planning
milestone, not a released version, development authorization or a package version bump.
Use Virgilio rather than VC in new discussion and documentation.

## Start here

- [Decisions, boundaries and versions](01-decisions-and-versions.md)
- [VIEC: provider-independent contract proposal](02-viec-proposal.md)
- [Citius scraper integration and upstream contract](03-citius-integration-proposal.md)
- [Joint review scenarios and open decisions](04-review-and-next-steps.md)
- [Supplied source reports and drafts](sources/README.md)

## Purpose

Plan Versioned Court Evidence Ingestion as a Virgilio-side capability, with
VIEC (Virgilio Evidence Ingestion Contract) independent of Citius. The Citius
Scraper Adapter is the first integration. Future providers or a direct Citius
API should connect through their own mappings without inventing scrape semantics.
The scope of the rest of 2.0.0 beta has not yet been established.

## Status and authority

Agreed planning principles are distinguished from unaccepted contract rules.
Neither contract is accepted or independently reviewed. No implementation,
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
