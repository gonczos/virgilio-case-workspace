# Recorded-reference API checkpoint

Date: 2026-09-03

## Implemented scope

The read-only endpoint is:

```text
GET /api/consultation/references/lookup
```

It exposes persisted reference observations using the frozen `value`, `scope`,
`lifecycle`, `limit`, and `offset` contract. It does not run ingestion,
reconciliation, extraction, or review writes.

Pilot membership is selected from explicit fixture provenance and recorded
lifecycle replacement relationships. Normalized-value equality is never used
to infer membership. Full and pilot corpus scope remain independent from
current and history lifecycle scope.

## Saved-response review

The following live responses were inspected against the local PostgreSQL state:

| Request | Observed result |
|---|---|
| `value=105398957&scope=pilot&lifecycle=current` | Two current observations: the directly anchored court occurrence and a separately attributed document-text citation; no superseded legacy duplicate |
| `value=105398957&scope=pilot&lifecycle=include_history&limit=1&offset=1` | The superseded pilot metadata observation links to current observation key `701c082328fd2a4b369529827269c37089c6fa1357d53e97049f815f545d2ceb` through its recorded reconciliation event |
| `value=2DD25E59-706D-44E7-A6DC-2A55C49EF3F9&scope=pilot&lifecycle=current` | One current source-document observation, two missing-file occurrence contexts, no associated binary and no open action |
| `value=13608/14.8T2SNT-E&scope=pilot` | No matches within the declared pilot coverage |
| `value=13608/14.8T2SNT-E&scope=full` | One corpus-level process-number observation with a direct case anchor and no forced binary |

The reused occurrence binary for `105398957` is returned once by full SHA-256
with both occurrence associations nested below it. Recorded occurrence dates
are serialized as source calendar dates (`YYYY-MM-DD`), not timezone-shifted
timestamps.

## Contract checks

- Pagination counts observations and probes one extra observation for
  `has_more` without returning it.
- Associated binaries are deduplicated by full SHA-256 while every document
  and occurrence association remains nested context.
- Missing-file records remain in `associated_contexts` and never receive an
  invented binary identity.
- Direct anchors, associated contexts, ingestion candidates, human review,
  provenance origin, lifecycle, and binary availability are separate fields.
- History results expose stable current/replacement observation keys and
  lifecycle events.
- `current_observation_key` is populated only from an observation whose current
  lifecycle state is actually `current`. A lifecycle event may still expose a
  related superseded or retired identity without mislabelling it as current.
- Full-scope responses state that external-register and document-text coverage
  remains pilot-only.
- Unknown, duplicate, malformed, and invalid query parameters use the frozen
  nested error envelope and stable codes.

## Remaining boundary

This checkpoint does not change the UI. It does not expand document-text
reference extraction beyond the pilot, resolve reference targets, or provide a
combined ranking between reference and text search.
