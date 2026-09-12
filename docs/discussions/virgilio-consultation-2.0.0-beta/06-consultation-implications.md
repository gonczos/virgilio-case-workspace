# Consultation implications of the scraper evidence inventory

Date: 2026-09-12. Status: Virgilio planning assessment/proposals, not approved UI,
first delivery scope, R3 conformance rules or implementation authorization.

## Input and verification boundary

Scraper inventory checkpoint: a895190b96c1a2313d7d67f09f3881d6b0a199e2.
File: docs/20-roadmap/phase-04-evidence-contracts/evidence-availability-investigation.md
in C:/repos/scraper/repository. Read using git show at that checkpoint.
The inventory identifies its investigated code input as
d38377cbcec58859c643896ce6b285ef2e1c3501. Do not conflate the report commit with the
investigation input or the older accepted contract checkpoints.

The [supplied response](sources/05-scraper-evidence-inventory-response.txt) is preserved
from user attachment b661eacb-9e09-4ffe-ac28-f5d8ba2211e4/pasted-text.txt, verified
against the original by SHA-256. The scraper reports bounded code/artifact inspection;
Virgilio has read that pinned report but has not independently repeated its artifact
counts, hash/path reconciliation or assessment investigation. Reported findings below
remain attributed to that investigation.

## Principal findings and consequences

| Inventory finding | Consultation consequence to plan |
| --- | --- |
| Full case JSON includes participant attributes, dates, flags and HTML omitted by the export | Preserve full context; do not present sampled participant fields as a complete party register |
| Bucket metadata selection and accumulated membership can span collections | Do not label the consolidated package as one coherent observation snapshot |
| Original listing rows retain multiplicity and context | Distinguish source occurrences from aggregated links and shared description variants |
| Recorded retrieval context can differ from actual transmitted parameters | Label recorded versus transmitted context; never infer an acquisition from token equality |
| Captures are often DOM fragments, not full HTTP/session recordings | Explain what the supporting artifact actually evidences |
| Individual failures/retries survive outside global binary links | Present actual attempts and inferred reuse separately; successful retry does not erase failure |
| Scope/times exist, but operational completed is not a future R4 guarantee | Separate outside scope, failure, unassessed and supported absence; export time is not observation time |
| General correction ledger is not implemented | Historical reconstruction is a new attributed derivation; source-versus-parser cause can remain unresolved |
| Parent rules and reuse can be inferred | Do not present legacy application assignments as court-observed edges |
| Detailed assessments differ from consolidated status fields | Show assessment provenance and actual result rather than a misleading unqualified summary |

The sample has 2,137 listing occurrences and 2,133 aggregated bucket/document links.
These are different units, not evidence-loss proof. The package's 217 unchecked binaries
coexist with retained warning assessments; unchecked cannot mean never assessed.
Historical readability reports exist even though sampled September package statuses
are empty. No new interpretation of those assessment discrepancies is established here.

## Relationship to the current consultation model

[Current court-record consultation model](../../architecture/12-court-record-consultation-read-model.md)
is already occurrence-centred and read-only. Its unit is the stored bucket_document
association, not necessarily an individual original listing row in a particular capture.
The inventory shows why the future design needs to retain that distinction, including
acquisition scope behind represented_by associations. Existing endpoint shapes or
canonical projections must not be relabelled as providing this richer history.

This is a comparison of documented semantics, not a new code/UI audit. Existing
architecture still documents current behavior; the following proposals do not change it.

## Proposed first consultation behavior

Keep normal case/bucket/document navigation understandable, with an explicit observation
or consolidation basis. Do not make users navigate every raw artifact merely to find
a document, but make the evidence basis accessible without inventing certainty.

- Collection basis: identify the selected collection/evidence revision and coverage
  limitations. A legacy consolidated view must be identified as consolidated.
- Document context: distinguish a listing occurrence, a description variant and an
  obtained binary; repeated appearances do not imply distinct binary content.
- Binary association: distinguish actual acquisition in this context, inferred reuse,
  unresolved association and no successful acquisition recorded. Current content
  availability and processing outcomes are separate dimensions.
- Evidence detail: expose supporting assertions/artifacts, actual attempts/retries,
  available times and attributed rule/assessment results as needed for inspection.
- Comparison: do not promise a historical comparison before one is supplied under
  supported policies. Apply R1 to exact revisions; no comparison differs from not assessed.
- Correction: selection of a current interpretation must preserve history and remain
  explicit; R5 branch resolution is still open.

Which collection/view opens by default and exactly which fields are prominent remain
user decisions. No implicit latest-arrival-wins or strongest-truth rule is proposed.

## Proposed answers to scraper questions — not final scope decisions

1. Start by assessing the retained September collection and its acquisition/retry
   evidence as a candidate bounded scope. It is a candidate, not a selected import.
   Do not require an immediate August-to-September change history without sufficient
   inputs and R4 policies. Keep existing consolidated material labelled with limitations.
2. Carry occurrences, actual acquisitions, inferred reuse and unresolved associations
   separately through the profile and adapter. Storage deduplication does not merge them.
3. Preserve required existing assessment inputs whenever the first delivery asserts
   their outcomes. Defer new OCR/readability runs and computed comparisons. Exact
   initially delivered assessments need selection after provenance/hash reconciliation.
4. Preserve all required original context. Interpret fields necessary for navigation,
   identity, scope and acquisition in the adapter; richer source-specific attributes
   can remain labelled context rather than universal VIEC fields. Detailed mapping is open.
5. Existing binary hashes do not alone prove complete custody of required assertions,
   artifacts or rules. A read-only custody/dependency inventory in Virgilio is needed
   before reusing dependencies; no such inventory is claimed in this assessment.
6. Make comparison availability and granular collection limits explicit. Do not infer
   historical absence, current binary equivalence or complete coverage from package counts.

## Remaining work and gates

- Discuss the candidate scope and desired normal consultation experience with the user.
- Identify the exact assessments/claims to expose, with all R2 supporting dependencies.
- Resolve retained path/hash/context joins and assessment discrepancies without new
  collection unless separately authorized. Unknowns remain explicit.
- Inventory already-held required material in Virgilio before choosing delivery contents.
- Jointly bound the first evidence exchange, then specify R3 units/acceptance/retry.
  R4 matching/coverage stays scraper-owned; R5 stays joint and open.

This checkpoint records the received investigation and a consultation assessment. It
neither accepts all inventory conclusions as canonical facts nor chooses features,
contracts, imports, collection enhancements or runtime changes.

## User direction after the inventory

The user wants connected case/bucket/document and binary/document-centred views over
rich structured evidence, plus management interfaces for ingestions and ingested
material with explicit decisions where questions arise. This is recorded in
[consultation and ingestion management](07-consultation-and-ingestion-management.md).
It advances the earlier open question about the normal consultation experience:
multiple entry perspectives are required, while exact views, default selections,
management actions and first-increment priorities remain to be planned. No runtime
or schema changes are authorized. Preserve prior proposals above as discussion history.
