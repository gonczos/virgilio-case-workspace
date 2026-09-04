# Reference-neighbourhood graph spike plan

Status: frozen bounded implementation plan.

Date: 2026-09-04

## Objective

Test whether a small read-only graph projection makes the already reviewed
reference `105398957` easier to understand without implying that candidate
relationships are facts.

## Fixture and source

The fixture is exact lookup value `105398957`, pilot scope, current lifecycle.
The projection consumes the existing recorded-reference lookup result and does
not independently reinterpret or query canonical evidence. The lookup currently
contains a directly anchored court occurrence and a separately attributed
document-text citation, together with source contexts and available binaries.

## Contract

Expose:

```text
GET /api/consultation/graphs/references/105398957?scope=pilot&lifecycle=current
```

Only `scope=pilot` and `lifecycle=current` are supported in the spike. Reject
unknown or duplicate parameters. Decode the path as UTF-8. Return:

```json
{
  "fixture": {},
  "nodes": [],
  "edges": [],
  "coverage": {},
  "limitations": []
}
```

Node kinds are `reference_value`, `reference_observation`, `case_file`,
`occurrence`, `source_document`, `representation`, and `binary`. Edge kinds are
`has_observation`, `directly_anchored_in`, `associated_with`, and
`represented_by`. Every edge carries `basis`, restricted initially to
`observed` or `source_recorded`. The spike must not emit candidate-target,
resolved-target, similarity, claim, or contradiction edges.

Deduplicate nodes and edges by stable domain identity. Binary identity is the
full SHA-256. Missing-file contexts remain source-document or occurrence nodes
and never receive invented binary nodes or open actions.

## Limits

The spike has depth two from the selected reference value, a maximum of 100
nodes and 200 edges, and no recursive client-controlled traversal. Truncation
must be reported explicitly. It performs no writes and introduces no graph
database or graph-library dependency.

## Acceptance

Automated tests must show that:

1. observations remain distinct from the shared reference value;
2. the citation and directly anchored occurrence remain distinguishable;
3. reused binaries are deduplicated by SHA-256 while retaining all contexts;
4. every edge exposes its factual basis;
5. no proposed or resolved relationship is invented;
6. missing-file contexts cannot gain a binary action;
7. output ordering is deterministic;
8. limits and coverage are explicit; and
9. the existing lookup and consultation API behavior remain unchanged.

The first implementation checkpoint is backend projection and saved-response
inspection only. A visual page, Cytoscape.js, Graphology, persistence, schema
change, and corpus-wide graph are outside this checkpoint.

## Stop boundary

After the read-only projection is implemented and reviewed, stop and decide
whether the graph contract is clearer than the existing lookup response. Only a
positive review may authorize a separate visualization slice.
