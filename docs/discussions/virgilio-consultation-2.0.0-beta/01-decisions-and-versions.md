# Decisions and independent versions

Status: planning register, 2026-09-12. No implementation changes.

## Agreed direction

- Phase name: Virgilio Consultation 2.0.0 beta — Planning.
- Use Virgilio, not VC, in new names. Older source drafts retain their original wording.
- Independently version contracts and submodules; application versions need not align.
- VIEC is provider-independent. Citius vocabulary and collection rules belong in
  the provider integration, not as universal ingestion requirements.
- Preserve evidence history: source observations, bytes and observed relationships.
  External reports are not unquestionable truth. Differences add evidence.
- Preserve the distinction between observations, interpretations and inferences.
- A listing is not an acquisition. Shared bytes do not prove shared acquisition context.
- Source changes, fresh identical observations, replay and correction are distinct.
- Practical case grouping does not establish a court relationship.

## Proposed contract positions carried into review

- First Citius increment delivers finalized snapshots, corrections and supplements.
  Finalized means activity ended and known coverage declared, including partial outcomes.
- Explicit provenance is required for historical supplement attribution; unresolved
  attribution must not expand established snapshot membership or coverage.
- Accept a declared delivery unit only when required contents and dependencies are
  validated. Dependencies may already be accepted; incomplete receipt is not acceptance.
- Explicit supersession proposes the current revision. Conflicting branches require
  attributed resolution; Virgilio preferences remain separate from scraper resolutions.
- Evidence may arrive before comparisons. Not supplied differs from not assessed.
- Evidence identity concerns defined content and provenance, not transport packaging
  or changes in storage location.

## Version register

| Item | Planning label | Status |
| --- | --- | --- |
| Virgilio Consultation | 2.0.0 beta | User-agreed planning milestone; no runtime bump |
| VIEC | 1.0.0-draft | Proposed initial contract label |
| Citius–Scraper collection contract | 1.0.0-draft | Proposed initial contract label |
| Scraper–Virgilio exchange profile | 1.0.0-draft | Proposed provider mapping; boundary still under review |
| Citius Scraper Adapter implementation | Unassigned | Independent version to be chosen before development |
| Scraper application | 0.3.0 | Proposed milestone in supplied upstream draft, not a release verified here |
| Other modules | Unassigned | Define when scope and responsibilities become concrete |

Contract draft revision, accepted contract version, collection identity, parser
version, comparison-rule version and software release version are different things.
The final application prerelease spelling and compatibility/version-change policy
remain open. Do not change package manifests to match these planning labels.

## Origin of this phase

The September 11 portable package prompted review of current upsert behavior.
Its package comparison reports +1 case, +7 buckets, +63 document identities,
+4 binary hashes and +60 document–binary links against August 30. It retains
1,293 earlier document identities while changing their package-local keys.
These figures describe package differences, not a verified live-database or court delta.

The review here inspected app/import-package.mjs: canonical upserts overwrite
selected metadata, workspace assignment follows parent trees across the database,
and package observations preserve only part of the delivered source context.
The supplied scraper review reports consolidation across collections and global
binary links that can obscure acquisition scope. These motivate planning, not
proof of particular irreversible evidence loss. See sources/01-scraper-review.txt.

## Component naming clarification

The user proposed Virgilio Evidence Broker as the name for the receiving capability.
Use Virgilio Evidence Broker for the component, and VIEC for the contract it enforces.
The exact component/module boundary and implementation version remain to be reviewed.
This naming does not authorize message brokers, queues or new infrastructure.
