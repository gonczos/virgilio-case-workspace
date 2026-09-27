# R3 negotiation: case units, acceptance profiles and required support

Recorded 2026-09-13. Consumer proposal for joint independent review and user decision.
No complete contract acceptance or implementation authorization.

## Inputs and changed planning boundary

Read scraper decision-record revision 18 at exact checkpoint
7d2e0e872d77a68db16b4eddc3a38227989bc391, its phase README and system architecture.
The decision record is the precise input where older index summaries retain earlier statuses.
Scraper owns separately versioned scraping, consolidation and export. Case is the only
export granularity; each case has its own full/incremental data, all/incremental/none
binary mode and one explicit baseline if either dimension is incremental. Shared parent
and relationship context uses exact revisions and explicit per-case dependencies.
Producer Success / Validation Error / Export Error is not broker acceptance.

These newer user decisions qualify [the earlier R3 table](16-r3-delivery-and-acceptance.md):
document and acquisition rows are now scenarios within a case export, not independently
selectable export units. Full scoped scraping does not prevent incremental case exports.
The user's Virgilio-side direction is configurable acceptance rather than one universal
rule. Versioned policy profiles below are a proposed expression of that direction; names,
policy contents and version values are not yet accepted.

## Proposed unit and policy rule

Evaluate each successful case result as a declared whole unit against an explicitly
selected, recorded broker acceptance-policy version and compatible adapter mapping.
Different cases can qualify independently; failure of a shared dependency affects each
case that requires it, not unrelated cases. Include the agreed parent context once per
exact revision in the package and retain each case's dependency edges. Receipt of shared
bytes is not acceptance of another case or evidence of acquisition through that case.

The export contract and selected consumer policy must make the unit's accepted claims
and required support explicit before acceptance. A policy cannot silently drop failing
claims after validation or reinterpret source history. Any deliberately narrower metadata
scope must be explicit and attributed, not an undocumented partial success. The broker
records the selected policy, exact case state/package, mapping and decision, including
limitations and missing dependencies. Configuration cannot waive identity, history,
provenance or the R2 support required for the claims actually accepted.

## Required support by claim: proposed minimum

| Accepted claim | Required retained support | Not implied |
| --- | --- | --- |
| Prepared case/listing/participant or relationship assertion | Exact delivered producer assertions, applicable source originals/context, rule definitions and input/revision lineage; projection/coverage limits; adapter mapping identity and outputs. Grouping origin stays explicit. | Raw-body parsing by Virgilio; complete source coverage; a procedural parent inferred from display/traversal grouping. |
| Producer report of an acquisition or measurement | Exact producer receipt/assertion, event and retrieval context, attribution and limitations. In a declared reference-only policy, describe the measurement as producer-reported over an identified but locally unavailable input. | Virgilio possession or independent verification of the binary, or satisfaction of a binary-custody obligation. |
| Acquired binary accepted into Virgilio custody, or a byte-dependent assessment accepted with inspectable inputs | Exact bytes, verified identity/length and acquisition/assessment assertions with exact inputs and rules. Bytes may already be retained and accepted locally; verify current availability. | Availability merely because a package or producer storage reference exists. |
| Correction, supplement or comparison | Exact affected revisions and support for attribution, rules and inputs; preserved prior assertions; comparison applicability remains exact-input scoped. | Silent source replacement, historical membership from filename/hash similarity, or automatic current-revision selection. |
| Listed-unacquired media / observed player response | Listing/source-hash states and supporting originals; actual attempt/player material where it supports the claim, with player measurements separate. | A mandatory nonexistent media file, actual-media digest/size, or fabricated failed acquisition when never attempted. |

Optional display enrichments not consumed or needed to inspect accepted claims need not
travel. If a prepared display value is delivered and used, retain its rule/input lineage.
Routine recovered diagnostics remain upstream unless needed to support evidence, coverage
or a limitation. No policy authorizes deleting upstream originals. Supporting response
and rule artifacts are not excluded merely because binary payload mode is none; the
contract must distinguish those categories even though all files physically contain bytes.

## What a successful export with omitted payloads can mean

| Producer result and receiver state | Proposed broker treatment |
| --- | --- |
| Success, binaries:none; binary-custody policy; all required bytes already accepted and presently retrievable in Virgilio | Accept after validating the full case unit and exact dependencies; no resend required. |
| Success, binaries:none; binary-custody policy; required binary absent locally | Incomplete for broker acceptance. Producer export can still be successful within its request. Obtain support separately or submit under a separately declared compatible policy; never downgrade requirements silently. |
| Success, binaries:none; explicitly selected metadata/reference-only policy | Accept the supported metadata and attributed producer reports with unavailable local byte input clearly recorded. Do not create a locally acquired/verified binary claim. This limited assertion boundary needs joint review and user agreement; it is not a waiver of R2 for accepted byte-dependent claims. |
| Success, incremental binaries; producer baseline supplied the omitted bytes but receiver lacks them | Incomplete under a policy requiring custody. Producer supplied-material history is not proof of receiver receipt. Receiver obtains the missing exact dependency or requests an appropriate case re-export. |
| Success, incremental data; receiver lacks required baseline assertions/rules/revisions | Incomplete until exact case baseline/support is retained and validated. Never apply the delta to a merely similar or latest local state. A historical full export is a recovery option, not a silent baseline substitution. |

No producer import/acknowledgement tracking is required: exporter declares exact package
and per-case resulting-state identities, baseline, included/referenced support and supplied
payload history. Virgilio tracks its receipts, accepted case states and custody. An immutable
package ID is not proof of either acceptance or possession. Replay preserves events;
identical content from a new collection still carries new observations/acquisitions.

## Negotiation points and independent-review questions

1. Confirm case-unit acceptance with shared dependencies, superseding finer export-unit
   suggestions without forcing all cases in a package to succeed together.
2. Confirm exact support categories and whether a deliberately reference-only acquisition
   report may be accepted under the proposed limited profile. If byte inspection is promised,
   those bytes remain required; profile labels alone cannot make them optional.
3. Specify how the case result declares omitted payload versus unavailable source evidence
   and the applicable support contract, so neither producer Success nor binary mode decides
   broker acceptance by itself. Requested/effective configuration and actual limitations
   remain distinct.

No substantive conflict was found in the newer producer decisions themselves. Their
required-support and binary-exclusion boundary is expressly undecided; this document
proposes that boundary rather than asserting it is implemented or jointly accepted.
R4 matching/coverage/compatibility and R5 revision resolution remain open. The historical
manifest limitation stays qualified. Scraper will arrange review of combined findings;
this consumer response is not independent approval.
