# Reference-neighbourhood graph backend spike

Date: 2026-09-04

Fixture: recorded reference `105398957`, pilot scope, current lifecycle.

## Result

The read-only projection produced 11 nodes and 16 edges:

| Kind | Count |
|---|---:|
| Reference value | 1 |
| Reference observations | 2 |
| Occurrences | 3 |
| Source documents | 2 |
| Representation | 1 |
| Binaries | 2 |

The two observations remain distinct: one is directly anchored to the recorded
court occurrence and the other to document text. All included nodes are within
two hops of the selected reference through explicit observation-context edges.
The two binaries are deduplicated by full SHA-256.

The graph contains only `observed` and `source_recorded` edge bases. It creates
no candidate target, resolved target, similarity, claim, or contradiction edge.
The fixture did not reach the fixed 100-node or 200-edge limit and was not
truncated.

## Endpoint

```text
GET /api/consultation/graphs/references/105398957?scope=pilot&lifecycle=current
```

The spike rejects other scopes, historical lifecycle queries, duplicate query
parameters, and unknown query parameters. Existing reference lookup remains the
source of the projection.

## Validation

Twelve focused graph and recorded-reference tests passed. Syntax checks and
`git diff --check` passed. A read-only live database call reproduced the counts
above and confirmed that every node is reachable within depth two. No database
write, schema change, graph dependency, UI, or corpus-wide traversal occurred.

## Limitations and decision

This validates the backend shape, not visual usefulness. Association edges
describe supplied context and must not be read as resolved reference targets.
The endpoint is intentionally pilot/current-only and has no client-controlled
traversal. The consultation service must be restarted before a running local
server exposes the new route.

The next decision is whether an independently reviewed response is sufficiently
clear to justify a separate minimal visualization slice.
