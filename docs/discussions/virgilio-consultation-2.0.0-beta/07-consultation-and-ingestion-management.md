# Connected consultation views and ingestion management

Date: 2026-09-12. Status: user-stated product direction for planning. No implementation,
schema, screen design or management action is authorized by this document. The
accepted semantic foundation and open R3–R5 boundaries remain in force.

## User requirements

The user wants a familiar overview of cases, buckets and documents; views of the
case material starting from binaries and from documents; rich structured records
supporting different perspectives; and management interfaces for ingestions and
ingested material, including deciding what should happen when questions arise.

This broadens the consultation discussion beyond one default hierarchical view plus
raw evidence details. No single view should determine which required evidence is kept.
First-increment boundaries and screen priorities have not been selected.

## Planning interpretation: one evidence base, connected views

| Perspective | Questions to support | Boundary to retain |
| --- | --- | --- |
| Cases and buckets | What is recorded under these cases/buckets, and which documents appear there? | Observation basis and coverage; original occurrences versus accumulated membership |
| Documents | Where does this document description occur, which variants and binaries are associated, and on what basis? | Matching/identity uncertainty; description equality is not proof of permanent court identity |
| Binaries | Where do these exact bytes appear, through which requests were they obtained, and which documents/cases are associated? | Actual acquisitions versus inferred reuse and unresolved associations |
| Evidence and history | Which observations, assessments or corrections support the selected view? | Exact revision inputs, provenance and comparison applicability |

These are perspectives over shared structured evidence, not separate competing sources
of truth. Switching perspective should preserve the relationship's basis. A binary
linked to several cases does not establish independent retrieval through every case.
Grouping bytes by hash must not erase distinct listing occurrences or acquisition events.
The exact navigation, filtering and visual representation remain to be designed.

## Ingestion and ingested-material management

User-requested capability: inspect and manage ingestions and accepted material, and
make explicit decisions where questions need resolution. Proposed planning topics:

- Identify incoming delivery/provider/version/scope and receipt/validation/acceptance
  state. Adapter success and partial receipt must not appear as broker acceptance.
- Explain missing required material, identity conflicts, mapping questions, unresolved
  attribution, failed attempts and unavailable accepted material with supporting evidence.
- Inspect affected cases, documents, binaries and dependencies from the management view.
- Define review actions and their consequences: supply missing material, retry delivery,
  correct a mapping, record an identity/association decision, resolve a revision branch
  or leave a question unresolved. These are candidates, not an approved action catalogue.
- Inspect custody, history and availability of already accepted material separately
  from historical acceptance. No deletion/disposal authority is granted here.

Management screens need a clear separation between observation of state and explicit
mutation/decision. Familiar consultation remains read-only by default; navigation must
not silently select preferences, resolve ambiguity or change evidence state.

## Decision boundaries to define

Each eventual decision must identify its scope, affected identities/revisions,
actor/authority, supporting basis and resulting attributed action. Preserve the prior
state and distinguish these meanings:

- An organizational grouping or presentation preference.
- A provider/source assertion or separately labelled human interpretation.
- An adapter mapping correction.
- A revision-resolution decision.
- Delivery acceptance, retry or remediation.

A human action does not turn an inference into a court observation or invent a missing
acquisition. Management cannot waive required-material/identity integrity obligations
merely by an unqualified force-accept button. Any legitimate limited profile must be
explicitly defined and preserve its limitations. The exact roles, allowed actions,
blocking conditions, reversibility and auditing remain open planning decisions.

## Effect on the current planning sequence

Before fixing R3 contents, work through three connected journeys using existing
material as examples: case -> document -> binary; binary -> related occurrences/cases;
and incoming delivery -> question -> explicit decision -> resulting state.

Map each journey to required evidence and preserved relationships, then decide a
bounded first slice. R3 owns delivery/acceptance conformance; R4 supplies supported
coverage/matching classifications; R5 covers revision-resolution rules. The management
requirement makes R3/R5 visible product behavior, not merely internal implementation.
Neither new collection nor implementing every proposed management action is implied.

No approved schema or graph-database requirement follows from multiple perspectives.
No automatic latest-wins or globally propagated source-change rule is introduced.
Current documented consultation behavior remains distinct from this future direction.

## Next decision

Describe the minimum information and useful transitions for the three journeys above,
then identify which questions the first management interface must allow a person to
resolve. Prioritize those capabilities with the user before selecting the first exchange
scope or detailed delivery schema. Keep required preservation independent of what is
prominent on screen.
