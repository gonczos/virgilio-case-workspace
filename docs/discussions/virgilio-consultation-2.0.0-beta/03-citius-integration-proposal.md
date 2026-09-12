# Citius integration — contract proposal

Status: unaccepted planning revision 3, 2026-09-12. No implementation authority.

## Boundaries

Citius -> Scraper -> Virgilio's Citius Scraper Adapter -> Virgilio Evidence Broker
-> Virgilio Consultation.

- Citius–Scraper defines collection and interpretation of the external source.
- Scraper–Virgilio defines the provider-specific delivered exchange profile.
- The adapter maps that exchange to VIEC as a separately attributed transformation.
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

## Alignment clarification: adapter mapping and acceptance

The adapter validates the scraper exchange and its mapping. The Evidence Broker
owns final VIEC acceptance; successful adapter processing alone is not acceptance.
Preserve the scraper-delivered assertions with exact upstream input/revision references.
Mapped outputs identify their adapter and mapping rules/version and remain traceable
to those inputs. In particular, mapping must preserve scoped coverage, unresolved
attribution and inferred reuse without strengthening their evidentiary status.

Mapping corrections retain earlier mappings and their lineage. They must not be
labelled as scraper-issued corrections or as new court observations/acquisitions.
The upstream contract has no assigned version; the initial review used revision 3 and the pinned scraper
commit in the review brief. The earlier 1.0.0-draft entry was a local suggestion,
not a joint upstream version assignment.

## Joint R1/R2 draft amendments — pending follow-up verification

For R1, the scraper identifies exact comparison dependencies and supersession links;
the adapter preserves them and records mapping revisions separately. Virgilio enforces
applicability to selected revisions under the VIEC R1 clause. An earlier comparison
remains a historical result, not a conclusion automatically rebound to corrected
coverage, evidence, interpretation or mapping. No immediate recomputation is required.

For the first Citius integration, Virgilio assumes preservation responsibility for
the required material of each accepted delivery unit, including original scraper
assertions consumed by its adapter. Before broker acceptance, required material must
be retained under Virgilio's custody and its identity, integrity and dependencies
validated. Previously accepted material may satisfy dependencies. Broker acceptance
records the custody commitment; receipt, staging or adapter success does not.

Mapping to VIEC does not replace preservation of original assertions and context.
The scraper's original-evidence retention obligation remains independent. Virgilio
acceptance or a later custody transfer never authorizes upstream deletion.

### Minimum required material

Required means necessary to inspect accepted claims, establish provenance and
understand their derivations, rather than every incidental collection file.

| Category | Preservation obligation |
| --- | --- |
| Original artifacts and binaries | Exact bytes of binaries delivered as obtained evidence and source captures/responses supporting accepted observations, interpretations or coverage; available supporting failure-response artifacts |
| Scraper assertions/context | Original consumed payloads; event identities; listing occurrences and attempts; source/request context and times; intended scope, actual coverage, failures/gaps; exact snapshot, assessment and evidence-set revisions |
| Interpretations/corrections | Historical results, exact inputs, parser/processor and rule/configuration identity, reasons and supersession lineage |
| Delivered comparisons | Results, exact baseline/target inputs and interpretation/coverage revisions, dimensions, reasons, compatibility basis and matching/normalization/comparison rules |
| Adapter mappings | Exact consumed upstream assertions, mapped results, rule/version identity, relevant configuration and correction lineage; retained by Virgilio |
| Required rule definitions | Retained identifiable definitions sufficient to understand derivations, not just labels pointing at mutable or unavailable documentation |

Missing required bytes/assertions, integrity failure, unresolved required input
revisions/provenance or missing required derivation basis blocks acceptance of the
unit. Temporary scraper-only storage cannot satisfy Virgilio's custody commitment.
The exact unit, manifest and conformance checks remain R3.

Incidental diagnostics, redundant copies and material not needed to support accepted
claims may be optional. Legacy/reference-only limitations require explicit profile
permission and attribution as never obtained, never supplied, later lost or unknown.
Required historical evidence must not silently become optional to pass acceptance.
A failed acquisition does not require a successful binary: retain available support
for the reported attempt/outcome and explicit limits, without inventing artifacts.

### Retention, transfer and later unavailability

There is no automatic expiry of required material in the first increment. Disposal
requires a separate explicit decision; acceptance, software upgrades and supersession
do not trigger deletion. This is a retention obligation, not a promise that physical
loss can never occur. Upstream retention remains separate and has no implied expiry
on downstream acceptance or transfer.

Later transfer follows VIEC's verified-access, integrity and explicit acknowledgement
rules before the previous custody commitment is released. Retain traceable custody
and locator changes. Transfer itself does not authorize disposal.

The responsible custodian records detected failure, affected evidence and inspection
limits and attempts recovery under an agreed policy; the broker preserves historical
acceptance and separately records present availability. No silent substitution or
claim of continued accessibility is permitted. Operational recovery details remain
open; executable reproduction is not promised by preservation alone.
