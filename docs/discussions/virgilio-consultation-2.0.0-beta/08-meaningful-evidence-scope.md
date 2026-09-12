# Meaningful evidence exposure — joint planning

Date: 2026-09-12. Status: coordinated proposal; scraper follow-up received and reviewed.
No complete-contract acceptance, schema or implementation authorization.

## Purpose and inputs

Determine which retained information the first Citius integration needs to convey,
before detailed R3 acceptance units and R4 policies. The user authorized direct
coordination with the scraper task. See the [coordination request](prompts/02-meaningful-evidence-coordination.md).

Virgilio input: c322aa1. Scraper inventory: 5e5b509. The accepted semantic planning
baseline remains unchanged. This document is a discussion proposal, not a replacement
for current architecture or a new independent implementation audit.

## Virgilio-side evaluation criteria

Meaningful data supports one or more of: inspecting what the court displayed, locating
it in its observed case/bucket/document context, identifying actual acquired bytes,
explaining the connections between those observations, establishing their scope and
limitations, or inspecting acceptance and the evidence underlying a delivered claim.
Information need not be prominent on a screen to be required supporting evidence.

| Need | Proposed evidence requirement | Boundary |
| --- | --- | --- |
| Case and bucket navigation | Recorded identifiers, labels, dates and observed membership with collection context | Source labels are assertions, not independently verified classification; convenience grouping is separate |
| Document-centred consultation | Individual listing occurrences, metadata, context and attributable associations | A shared document description must not collapse repeated occurrences or imply permanent source identity |
| Binary-centred consultation | Content identity, acquired bytes, actual acquisition links and their context | One stored binary may support several distinct acquisitions; equal content does not establish acquisition in another case |
| Understand history | Observation/event identity, source versus collection times, revision and derivation lineage when available | Historical gaps stay unknown; no invented correction ledger or chronology |
| Understand scope | Declared collection scope, known coverage and meaningful unresolved limitations | Operational completion and no-match results do not prove court-record completeness or absence |
| Inspect delivered claims | Exact original inputs, captures and attributed mapping/assessment rules required by each claim | Supporting artifacts need not become universal VIEC fields; no unsupported summary statuses |
| Inspect ingestion | Delivery identity, dependencies and acceptance basis as later defined by R3 | These are exchange/broker records, not scraper operational logs or source facts |

The existing import contract exposes consolidated cases/buckets/documents and links.
The existing consultation model queries stored bucket_document associations. Those
current interfaces cannot by themselves establish individual source listing events,
acquisition history or coherent snapshots. This conclusion follows the existing
architecture documents and attributed scraper inventory; no new runtime audit is claimed.

## Proposed delivery classification

- Structured: fields needed to navigate, relate, distinguish and qualify evidence.
- Supporting: original assertions/artifacts and rules needed to inspect those fields
  and reproduce their declared interpretations, under R2.
- Conditional: assessments or special context required when their claims are delivered
  or when they explain an evidence/coverage limitation.
- Upstream-only: routine operating details with no such consequence or dependency.

Conditional does not waive a required supporting dependency. Missing material may
require narrowing a proposed claim or declaring a limitation; it cannot be silently
replaced with an unsupported assertion. Exact acceptance treatment remains R3 work.

## Current architecture references

- [Current import contract](../../architecture/02-import-contract.md)
- [Current consultation read model](../../architecture/12-court-record-consultation-read-model.md)
- [Accepted semantic planning baseline](../../architecture/24-virgilio-2-semantic-planning-baseline.md)

## Next coordination step

Review the scraper's concrete field matrix against these needs, retain its exact
checkpoint, resolve mapping ambiguities directly, and present a bounded proposed
first scope with remaining decisions. Detailed screens, new collections, new analysis,
R3 acceptance mechanics, R4 policy choices and R5 resolution remain outside this slice.

## User refinement: relevance beyond the current database

The user explicitly extended this slice to meaningful data the scraper currently
ignores or omits from database storage. The collection-to-artifact-to-database-to-export
path must be examined; current database fields are not the proposed scope ceiling.

For each omission distinguish:

- Retained outside the database: potentially exposable without new collection.
- Extracted but not retained: future capture/persistence work may be needed; check
  other artifacts before claiming the historical value is unavailable.
- Potential source fields not verified as collected: an investigation candidate,
  not evidence already obtained.

Recommend structured ingestion where a field supports useful filtering, navigation
or relationships; preserved source context where meaningful but not yet mapped;
deferral where value or semantics remain uncertain; exclusion where operational or
irrelevant. An omitted field is not automatically important merely because it exists.
The purpose is useful consultation, not exhaustive auditing of the court system.
This refinement was sent to the scraper in the active coordination task. It authorizes
analysis and documentation, not implementation or new collection.

## First scraper matrix reviewed

Read the scraper matrix at e4d13f49e30019d2fc7ac5497acb3678e310832c:
C:/repos/scraper/repository/docs/20-roadmap/phase-04-evidence-contracts/first-exchange-evidence-matrix.md.
Its checkpoint records source-field names, original versus derived meaning, scope,
current exposure, limitations and proposed delivery classes. It is a scraper proposal;
this review is coordination, not independent review or accepted first scope.

The matrix supports structured cases/buckets/individual listing occurrences, original
metadata, contextual retrieval tokens, actual acquisitions, binary identity and known
scope/limitations. Supporting inputs retain richer values, captures and interpretation
basis; selected assessments require their exact inputs and rules. Routine recovered
operational details need no structured consultation representation.

Virgilio sent these proposed refinements directly for the scraper's active follow-up:

- Include participant names/designations as structured source-labelled context because
  they support consultation. Do not merge canonical persons or claim a full party list.
- Keep uncertain portal flags as raw labelled context until semantics support typed
  interpretation. Archive/finished flags may matter but must not gain invented meaning.
- Include inferred binary reuse as explicitly derived associations where exact inputs
  can be established; otherwise leave unresolved. Never imply another actual acquisition.
- Preserve legacy convenience parent assignments as labelled legacy context without
  promoting them to source relationships.
- Keep September as a candidate for bounded reconciliation, not accepted delivery scope.
  Existing qpdf claims remain conditional on input/report reconciliation; new processing
  stays deferred.

These positions await the omission-analysis response. They refine a proposal, not the
accepted semantic foundation. Source-field characterization is attributed to the scraper;
Virgilio has not repeated its bounded artifact/code investigation.

## Omission-analysis findings reviewed

Read the scraper's follow-up matrix diff during coordination; the final checkpoint is
recorded below after completion. Its method combines importer/collector code tracing
with bounded retained artifact inspection, not a live database audit. Accordingly,
database preservation below describes the inspected ingestion path, not independently
verified contents of every database row or historical run.

| Gap | Finding and proposed action |
| --- | --- |
| Participant labels | Full case artifacts retain names/designations omitted by consumed case checkpoints. Propose structured source-labelled context with exact observation inputs. |
| Case dates/status/court context | Richer checkpoint fields survive in database source-row JSON, while canonical/export projections omit or replace context. Expose observed values separately from configured/canonical metadata. |
| Bucket size and identifiers | Full artifacts retain displayed raw/parsed size and DOM context omitted by consumed entry checkpoints; the inspected ingester writes NULL for displayed size. Recover supported values from retained artifacts. |
| Listing occurrences and acquisitions | Richer JSON/results retain original occurrences, times and acquired-through context that consolidated projections omit. Preserve events and distinguish supported derived reuse. |
| Captures and collection scope | Original files/manifests carry context missing in projections. Reconcile availability and supported intervals; do not invent complete coverage or exact missing times. |
| Assessments | Retained reports can be richer than export summaries. Keep selection conditional on matching exact input bytes, reports and provenance; do not equate unchecked with never assessed. |
| Extracted but unsaved details | Repeated all-case reads and unselected response headers are not fully retained by the inspected paths. Further capture is not a blanket requirement; establish concrete consultation value first. Historical values cannot be inferred from later observations. |
| Uninspected source surfaces | Additional parties/relationships/fields remain unverified candidates, not collected evidence or approved capture work. |

The scraper incorporated Virgilio's proposed participant, flag, inferred-reuse and legacy
parent refinements and reported no substantive objection. This is coordinated proposed
wording, not user acceptance of the first scope, independent verification or closure of
R3–R5. Useful evidence retained outside SQL can often be exposed without new collection,
but this does not mean its mapping or delivery is already implemented.

## Completed coordination checkpoint and disposition

Scraper follow-up checkpoint: 0ee30fe42b1d0f53cd411e7d35a119f1eaf914a3.
Reviewed document: C:/repos/scraper/repository/docs/20-roadmap/phase-04-evidence-contracts/first-exchange-evidence-matrix.md.
The preceding original matrix checkpoint remains historical. The scraper reports
working/staged diff and link checks passed, clean working tree and no runtime changes.
Virgilio reviewed the proposal and recorded the findings and refinements above; it did
not perform a live database audit, new scrape or full historical artifact reconciliation.

This completes direct coordination for the field-level relevance proposal, including
omissions before SQL ingestion. Proposed priorities are useful case/participant labels,
bucket descriptors, individual document occurrences, actual acquisitions/binaries,
supported associations and meaningful scope/limitations, with required supporting inputs.
Uncertain flags remain labelled context; assessment claims remain conditional; routine
operational diagnostics stay upstream. Existing retained evidence and future capture
candidates remain separate.

Next: present this proposed relevance scope to the user, select the bounded first
collection/claim set, then plan bounded input/capture/association reconciliation and
R3 delivery requirements alongside R4 policies. Do not assume a live import, new
collection, complete-contract acceptance or implementation authorization. R5 remains open.
