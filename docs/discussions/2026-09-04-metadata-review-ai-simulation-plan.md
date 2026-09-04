# Metadata-reference review AI simulation

Status: agreed execution prompt; documentation only

Date: 2026-09-04

## Decision

The 24-item metadata-assertion review may be used as a controlled experiment in
which an independent sub-agent acts in the same case-support reviewer role used
during the guided text review. Role continuity does not change who produced a
decision. The simulation must therefore record both:

- `reviewer_role`: `case_support_reviewer_attila_test_1`
- `reviewer_identity`: `simulated_case_reviewer_agent_1`
- `reviewer_kind`: `ai_simulation`
- `human_reviewer`: `false`

The simulated decisions must not be attributed to Attila or described as human
review. Uncertainty, disagreement, and requests for source verification remain
structured instead of being forced into resolved conclusions.

If Attila later accepts or changes a simulated decision, that action is stored
as a separate review event with human provenance. Until that happens, the
simulation does not satisfy the human-review requirement in the frozen
`reference-expansion-v1` protocol and the metadata fixture cannot be described
as human-reviewed or finally frozen under that protocol.

This experiment tests how much of the review workload an AI reviewer can
prepare reliably. It does not authorize database writes, ingestion, target
resolution, extractor execution or modification, or changes to the frozen
selection inventories.

## Aligned execution prompt

```text
Prepare the reviewed capped-expansion metadata fixture using parallel subagents
where safe.

Repository:
C:\repos\virgilio-case-workspace

Read and follow the applicable AGENTS.md and the frozen protocol:
docs/evaluation/2026-09-04-reference-extraction-capped-expansion-protocol.md

Source inventory:
docs/evaluation/reference-extraction-expansion-v1/metadata-selection.json

The text fixture was frozen separately in commit 83b2286. Do not modify it and
do not run labelled-reference-v4. This task concerns only the 24 selected
metadata assertions: eight reused-binary assertions, eight assertions whose
source records have no available binary, and eight ordinary binary-linked
controls.

Use subagents as follows:

1. The primary agent is the only writer for the candidate reviewed metadata
   fixture and related documentation.
2. One read-only subagent acts as the simulated case reviewer. Record its
   provenance exactly as:
   - reviewer_role: case_support_reviewer_attila_test_1
   - reviewer_identity: simulated_case_reviewer_agent_1
   - reviewer_kind: ai_simulation
   - human_reviewer: false
3. One read-only subagent independently validates all stable source-assertion
   identities, raw and normalized values, source fields, direct anchors,
   occurrence contexts, binary availability states, category membership,
   counts, ordering, and provenance.
4. If capacity permits, one additional read-only subagent reviews the simulated
   classifications for unsupported inferences, hidden uncertainty, and false
   target or binary resolution.

Independent reviewers must inspect the completed artifact, not merely its
proposed schema. The primary writer addresses their findings and reruns
validation.

For each assertion, preserve:

- stable source-assertion identity and seeded rank;
- exact raw and normalized values and normalization identity;
- court-metadata origin, source field, and identifier type;
- direct case, occurrence, or document anchor exactly as supplied;
- every source-provided procedural context;
- binary association state and available/missing counts;
- associated binary SHA-256 values where actually present;
- unresolved target and relationship states;
- structured uncertainty and remaining verification;
- complete simulated-review provenance.

Do not infer a target, relationship, date, process, document, binary, or
availability state from text or chronology. Do not treat repeated contexts as
duplicates. Do not invent open actions for missing files. Preserve reused
binary contexts independently. A source-recorded observation remains an
observation, not a resolved document identity.

Acceptance criteria:

- exactly 24 distinct stable source assertions;
- exactly 8 reused-binary, 8 all-associated-files-missing, and 8 ordinary
  binary-linked assertions;
- source identities, raw values, anchors, contexts, ordering, and binary states
  reproduce the frozen selection exactly;
- zero fabricated binaries, contexts, dates, targets, relationships, or open
  actions;
- all uncertainty and verification needs are machine-readable;
- strict UTF-8, valid JSON, deterministic serialization, and stable IDs;
- byte-for-byte regeneration succeeds;
- git diff --check passes;
- no database writes and no changes to ingestion, APIs, UI, processors,
  labelled-reference-v4, text fixtures, or frozen selection inventories.

When the candidate fixture passes simulated semantic review and independent
technical validation:

- show the changed files and validation results;
- leave its status explicitly pending human review;
- do not claim that it satisfies the protocol's human-review gate;
- do not commit unless the initiating user explicitly requested a commit;
- stop without running metadata retrieval evaluation or the expanded text
  extractor baseline.

Any later human approval must be recorded as a separate attributable review
event. Only that event may advance the fixture from pending human review to the
protocol's frozen reviewed state.
```

## Expected checkpoint

The result of this prompt is a deterministic candidate metadata fixture with
AI-simulated semantic decisions and independent technical validation. The next
step is a focused human review of those decisions, preferably limited to
disagreements, ambiguities, and material assertions while still recording an
explicit decision for every assertion required by the frozen protocol.
