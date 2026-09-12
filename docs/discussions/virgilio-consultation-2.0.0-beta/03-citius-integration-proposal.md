# Citius integration — contract proposal

Status: unaccepted planning revision 1, 2026-09-12. No implementation authority.

## Boundaries

Citius -> Scraper -> Virgilio's Citius Scraper Adapter -> Virgilio Evidence Broker
-> Virgilio Consultation.

- Citius–Scraper defines collection and interpretation of the external source.
- Scraper–Virgilio defines the provider-specific exchange profile and mapping to VIEC.
- VIEC defines provider-independent acceptance and preservation obligations.
- The Evidence Broker is the proposed Virgilio component enforcing those obligations.

The upstream revised draft is preserved in sources/03-citius-revised-draft.txt.
Its replay and finalization clauses are amended by sources/04-citius-amendments.txt.
These supplied documents are proposals, not independently verified implementation.
They predate the provider-independent VIEC split and must be read with that boundary.

## Consolidated upstream semantics

Snapshots identify contract version, intended scope, actual coverage, attempts,
times, failures and gaps. They describe an interval, not a simultaneous source state.
Full means complete within declared scope and completion criteria. Listing and
acquisition coverage are distinct; a partial snapshot can have completed subscopes.

Preserve cases, buckets, listing occurrences and multiplicity, description variants,
opaque retrieval tokens with request context, binaries and individual retrieval
attempts. data-proc is the inspected bucket attribute; data-procinfo is the document
retrieval token. Matching rules must not assume permanent court identities.

Comparisons identify baseline and target, exact evidence/interpretation revisions,
contract compatibility, matching/normalization rule version, dimensions and reasons:
new relative to a sufficiently covered baseline; unchanged on assessed dimensions;
altered where a supported difference exists; absent within a successfully covered
scope; not assessed where comparison lacks support. First observed does not prove
source novelty. Unresolved matching must not manufacture a new/absent pair.

Metadata, membership and acquired-binary associations are assessed separately.
Parent summaries disclose assessed dimensions; a child's change does not prove
parent metadata or unobserved children changed. No retrieval means binary content
was not assessed. Representative retrieval is valid; reuse in another case is an
inferred association, not an independently observed acquisition.

Fresh collection is a new event even if bytes match. Replay concerns the same
identified event and evidence. Corrected parsing retains the prior interpretation
and creates attributed revisions; comparisons may be revised without a new scrape.

An open snapshot may continue through retries of unfinished work under the same
scope, contract, compatible source context and predeclared window. Re-observing
successful scope, expiry, changed scope/contract or a finalized snapshot leads to
another snapshot under the current proposal. Exact limits remain unresolved.

Finalization means the collection activity ended and known coverage was declared,
not that it succeeded completely. Preserve original evidence membership and coverage.
A corrected coverage assessment is a linked revision. An omitted artifact is a
supplement only with supported attribution; otherwise provenance stays unresolved.
A supplement can reveal a historical event but does not claim a newly performed one.
New collection/acquisition belongs to another linked snapshot. All earlier attempts,
failures, delivered states and relevant derivations remain traceable.

## Initial Scraper–Virgilio exchange profile

Deliver finalized snapshots, including partial/failed outcomes, plus subsequent
corrections, supplements and comparisons. Provisional delivery is deferred.
Declare exact snapshot evidence-set, coverage and interpretation revisions. Carry
source identifiers with their scope, listing/acquisition distinctions, observed
relationships, inferred reuse, artifact references and individual attempt outcomes.

Apply VIEC delivery acceptance, conflict, replay and comparison-availability rules.
Historical supplement attribution requires a traceable link to the original
collection or attempt. Manifest references are one possible basis, not the only one;
filename similarity or matching bytes alone are insufficient.

Source comparisons belong to the scraper; the adapter preserves and validates
their declared basis. It does not certify the court's assertions. Virgilio may make
separately attributed derivations. Practical workspace grouping remains separate.
E.L1 grouping and the provenance of legacy A/C/D/E parent assignments remain matters
to handle explicitly, not relationships to infer from the new ingestion design.

## Open integration decisions

Matching rules; completion criteria; collection-window/resume conditions; baseline
selection across unequal coverage; summary aggregation; version compatibility;
minimum supplement-attribution evidence; delivery acceptance granularity; revision
branch resolution; required/optional comparison fields and status vocabulary.
