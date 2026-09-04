# Relational evidence graph direction

Status: open project note for discussion. This is not authoritative
architecture, an implementation contract, or authorization to introduce a
graph database, API, or UI.

Date: 2026-09-04

## Purpose

Recovered references, procedural occurrences, repeated documents, and later
claim comparisons form a network rather than a simple list. A graph-shaped
investigation view could help a user understand where a reference was observed,
what it might identify, which evidence supports a proposed relationship, and
whether anyone has reviewed it.

The graph must represent uncertainty rather than turn proximity or similarity
into fact. It is a derived consultation projection over preserved evidence,
metadata, observations, proposals, and review decisions.

This direction complements:

* `2026-09-03-reference-investigation-and-review-direction.md`;
* `2026-09-04-document-and-passage-repetition-direction.md`; and
* `2026-09-04-claim-and-argument-comparison-direction.md`.

It does not change their boundaries or authorize their implementation.

## Layers to keep distinct

### Evidence identity

Possible nodes include original binaries, source documents, representations,
pages, passages, and immutable hashes. Edges in this layer should normally be
mechanically established or source-recorded.

### Procedural context

Cases, occurrences, dates, filing packages, parties, institutions, and
source-system references describe where material appears in the record. The
same binary may occur in several contexts, and one occurrence may contain
several documents or binaries.

### Reference observations

Each exact reference observation remains a node or independently addressable
record connected to the passage or metadata field in which it was observed.
Equal normalized values do not by themselves establish equal targets.

### Candidate relationships

Edges such as `may_identify`, `possible_attachment_of`, `possible_embedded_copy`,
`possible_duplicate`, and `possibly_cites` are proposals. They retain their
producer, method or model, version, inputs, rationale, confidence dimensions,
and alternatives.

### Reviewed relationships

Human confirmation, correction, rejection, and unresolved decisions remain
separate attributable events. Review does not erase the proposal or underlying
observation. A confirmed classification does not silently resolve a target or
relationship.

### Repetition and semantic overlays

Document equivalence, containment, and repeated-passage candidates belong to a
repetition overlay. Claims, speakers, recurring questions, responses, and
apparent contradictions belong to a later semantic overlay. Neither should be
mixed into the factual evidence layer or displayed as established truth merely
because an algorithm produced it.

## Relationship states and visual meaning

The API and UI should expose relationship basis directly rather than relying on
colour alone. Candidate states include:

* `mechanically_established` for identities such as matching SHA-256;
* `source_recorded` for relationships explicitly supplied by the source system;
* `observed` for a reference or passage found in an identified input;
* `deterministic_proposal` for a reproducible rule-derived candidate;
* `ai_proposal` for an attributed model-produced candidate;
* `human_confirmed`, `human_corrected`, or `human_rejected`; and
* `unresolved` or `superseded` without implying deletion.

One possible visual convention is solid edges for mechanically established or
source-recorded relationships, dotted edges for proposals, and explicit text or
markers for reviewed states. Accessibility requires labels or shapes in
addition to colour.

## Possible investigation views

* **Reference neighbourhood:** every passage and metadata assertion containing
  a selected reference, plus possible and reviewed targets.
* **Procedural timeline graph:** occurrences ordered by their recorded dates,
  allowing one reused binary to appear in every applicable context.
* **Filing-package graph:** a filing, manifest, attachments, missing media, and
  uncertain package relationships.
* **Repetition graph:** exact reuse, alternate-copy candidates, embedded copies,
  and aligned passages.
* **Claim-history graph:** attributed statements addressing a selected question,
  with proposed compatibility or contradiction relationships.
* **Evidence-layer controls:** recorded facts remain visible while proposals and
  semantic overlays can be independently shown or hidden.

A bounded neighbourhood is preferable to rendering the complete corpus graph.
It is more understandable, cheaper to compute, and less likely to create false
meaning through visual density.

## Backend direction under consideration

PostgreSQL should remain the authoritative evidence, provenance, observation,
and review store. The initial backend need only assemble a read-only graph
projection with a stable domain-owned contract:

```json
{
  "nodes": [],
  "edges": [],
  "coverage": {},
  "limitations": []
}
```

Each node and edge should have a stable identity, kind, provenance, lifecycle or
review state, and permitted navigation actions. The response contract should
not expose local paths or make a library-specific serialization the domain
model.

PostgreSQL queries, including bounded recursive traversal where useful, may be
sufficient initially. Graphology is a possible in-memory JavaScript multigraph
and algorithm layer when traversal or graph algorithms materially help.
Cytoscape.js is a possible interactive frontend renderer and can also perform
headless analysis, but its model should not become authoritative.

Apache AGE or Neo4j would add graph-query capabilities at the cost of another
extension or datastore, synchronization rules, deployment work, and operational
ownership. They should not be introduced unless a bounded experiment shows that
PostgreSQL plus a projection layer cannot support required traversals or
performance.

## Possible smallest experiment

One read-only endpoint could project the neighbourhood of a reviewed reference:

```text
reference observation
  -> observed passage or metadata field
  -> source document and occurrence contexts
  -> associated binaries
  -> candidate target observations
  -> proposal and human-review history
```

The fixture should contain at least one resolved or confirmed relationship, one
ambiguous reference with multiple candidates, one reused binary, one missing
file, and one rejected candidate. The experiment should not write decisions or
attempt a corpus-wide layout.

Evaluation should ask whether a user can:

1. distinguish an observation from a resolved target;
2. identify the evidence and procedural contexts supporting every edge;
3. distinguish recorded, deterministic, AI-proposed, and human-reviewed states;
4. navigate to available original evidence without inventing actions for
   missing files;
5. understand reused binaries without mistaking occurrences for separate
   documents; and
6. detect when graph coverage is incomplete.

## Open questions

* What stable node and edge vocabulary is sufficient for the first reference
  neighbourhood?
* Should passages be nodes, edge evidence, or both depending on the view?
* How should historical and superseded edges be queried without overwhelming
  ordinary consultation?
* Should graph layout be computed in the browser or supplied as disposable
  backend projection metadata?
* Which traversal limits prevent accidental full-corpus expansion?
* How should graph coverage differ between metadata references and extracted
  document-text references?
* When would Graphology add value beyond plain SQL assembly?
* What measured requirement, if any, would justify Apache AGE or a separate
  graph database?
* How should the dedicated human-review interface and graph investigation view
  share evidence without becoming one oversized workflow?

## Decision boundary

No graph schema, persistence layer, extension, database, traversal API,
visualization library, corpus-wide projection, or relationship inference is
authorized by this note. Before implementation, a separate bounded plan must
freeze the node and edge contract, fixture, traversal limits, coverage
semantics, acceptance tasks, and validation strategy.
