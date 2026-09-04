# Human-reviewed metadata fixture v1

`metadata-reviewed-fixture-v1.json` records an AI-simulated semantic review and
a subsequent, separately attributable human review of the 24 assertions
selected in the frozen `metadata-selection.json`.

The simulation uses reviewer role `case_support_reviewer_attila_test_1` for
workflow continuity. Its actual producer is
`simulated_case_reviewer_agent_1`, with `reviewer_kind: ai_simulation` and
`human_reviewer: false`. It must not be described as a decision made or
approved by Attila.

Every source assertion is copied without changing its identity, value,
normalization, anchor, contexts, availability, category, or seeded ordering.
The review accepts the item as a source-recorded metadata observation while
leaving targets and relationships unresolved. Missing-file status means that
no associated binary is available in this snapshot; it does not mean the
source record, reference, or document is absent.

The AI decisions remain separately attributed under `simulated_review`. During
the guided review session `guided-metadata-review-attila-test-1`, human reviewer
`case_support_reviewer_attila_test_1` confirmed all 24 decisions. The human
review preserved every source assertion and context while leaving target and
relationship resolution open. This attributable event satisfies the protocol's
human-review gate; it does not turn unresolved targets into resolved facts.
