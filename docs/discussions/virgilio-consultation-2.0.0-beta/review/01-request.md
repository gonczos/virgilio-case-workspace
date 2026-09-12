# Independent joint contract review — request

Date: 2026-09-12. Authorized by the user: one independent reviewer examines both
projects together. This is planning review, not implementation or contract acceptance.

## Fixed inputs

Virgilio repository: C:/repos/virgilio-case-workspace
Commit: da7948d9279f7a6209dcf027c7c85781076901c1
Planning directory: docs/discussions/virgilio-consultation-2.0.0-beta/
Read README.md, 01-decisions-and-versions.md, 02-viec-proposal.md,
03-citius-integration-proposal.md and 04-review-and-next-steps.md.

Scraper repository: C:/repos/scraper/repository
Commit: 8f6b1b7e42406387d38040e6b652def5ae706153
Tag: scraper-0.2.6-baseline
Directory: docs/20-roadmap/phase-04-evidence-contracts/
Read citius-scraper-contract-proposal.md (revision 3), decisions-and-review.md
(revision 3) and implementation-grounding.md. The scraper's retained exchange draft
is historical input; Virgilio's checkpoint provides the updated VIEC/broker boundary.

## Assignment

Review the complete path from collection through adapter mapping to broker acceptance.
Use pinned Git content and applicable repository instructions. Challenge the contracts
rather than assuming the authors' conclusions. Do not change either repository,
perform database operations, imports, scrapes, processing, migrations or deployment.
Consult implementation read-only where needed; distinguish verified findings from
claims in supplied reports. Do not mistake explicitly open implementation choices
for contradictions, or prescribe infrastructure without a contractual need.

Assess the shared scenarios, especially:

- A-only binary acquisition must not become an observed acquisition in B.
- Fresh identical events versus replay of the same evidence.
- Partial scope, qualified absence and resumed collection intervals.
- Exact interpretation and mapping lineage, including corrections.
- Historical supplements and unresolved attribution.
- Revision branches, supersession and attributed resolution.
- Delivery completeness, dependencies, rejection and retry.
- Evidence delivered before comparisons; exact comparison inputs.
- Broker final acceptance versus successful adapter transformation.
- Provider-independent VIEC and Citius-specific collection semantics.

## Required result

Return a self-contained report with pinned inputs, verdict (not approval), prioritized
findings with concrete failure scenarios, responsible owners, exact pinned path/line
references and resolution directions. Separate blockers to contract acceptance,
decisions needed before implementation and optional suggestions. Include scenario
coverage, limitations and remaining questions. A single reviewer covers both sides;
no additional agents are requested.

The reviewer is an AI subagent that did not author these drafts. It receives the
conversation context and is not a blind review or external human certification.
The coordinating agent will preserve the findings separately from author responses.
