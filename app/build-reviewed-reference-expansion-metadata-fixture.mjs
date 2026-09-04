import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const SOURCE = "docs/evaluation/reference-extraction-expansion-v1/metadata-selection.json";
const OUTPUT = "docs/evaluation/reference-extraction-expansion-v1/metadata-reviewed-fixture-v1.json";
const SIMULATED_REVIEWER = { reviewer_role: "case_support_reviewer_attila_test_1", reviewer_identity: "simulated_case_reviewer_agent_1", reviewer_kind: "ai_simulation", human_reviewer: false };
const HUMAN_REVIEW = {
  review_session_id: "guided-metadata-review-attila-test-1",
  reviewer_identity: "case_support_reviewer_attila_test_1",
  reviewer_kind: "human",
  human_reviewer: true,
  reviewed_at: "2026-09-04T00:28:24.1282756Z",
  method: "interactive_guided_review",
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourceText = await readFile(SOURCE, "utf8");
const source = JSON.parse(sourceText);
const assertions = source.selected_candidates.map((candidate) => ({
  assertion_id: `metadata-expansion-v1-${candidate.source_assertion_key.slice(0, 16)}`,
  source_assertion: candidate,
  simulated_review: {
    ...SIMULATED_REVIEWER,
    review_state: "pending_human_review",
    decision: "accept_as_source_recorded_metadata_observation",
    classification: candidate.identifier_type,
    classification_basis: "documented_source_field_contract",
    target_resolution: "unresolved",
    relationship_resolution: "unresolved",
    availability_interpretation: candidate.category === "missing_file"
      ? "No associated binary is available in the reviewed snapshot; this does not mean that the source record, reference, or document is absent."
      : "Preserve only the binary associations supplied by the frozen inventory; they do not resolve the referenced entity.",
    uncertainty: candidate.identifier_type === "source_document_reference"
      ? ["The opaque source value's referenced entity and meaning remain unresolved.", "The direct document anchor records metadata provenance and is not resolved referenced-entity identity."]
      : ["The occurrence reference is classified from its source field; linked document and binary contexts do not become its resolved target."],
    remaining_verification: candidate.category === "missing_file"
      ? ["human_approval", "target_resolution", "future_binary_availability_check_if_needed"]
      : ["human_approval", "target_resolution", "binary_identity_if_needed"],
    rationale: "Accept the source-recorded observation and preserve its supplied anchors, contexts, values, ordering, and association state without inferring a target or relationship."
  },
  human_review: {
    ...HUMAN_REVIEW,
    review_state: "human_reviewed",
    decision: "confirmed_simulated_decision",
    confirmed_classification: candidate.identifier_type,
    target_resolution: "unresolved",
    relationship_resolution: "unresolved",
    remaining_verification: candidate.category === "missing_file"
      ? ["target_resolution", "future_binary_availability_check_if_needed"]
      : ["target_resolution", "binary_identity_if_needed"],
    rationale: "The human reviewer confirmed the source-recorded metadata observation, its direct anchor, associated contexts, and recorded binary-association state while leaving target and relationship resolution open."
  }
}));
const fixture = {
  schema_version: 1,
  fixture_id: "reference-extraction-expansion-metadata-v1",
  fixture_kind: "human_reviewed_metadata_observation_fixture",
  status: "human_review_complete",
  protocol_version: source.protocol_version,
  selection_fixture: SOURCE,
  selection_fixture_sha256: sha256(sourceText),
  reviewer_provenance: {
    simulated_review: SIMULATED_REVIEWER,
    human_review: HUMAN_REVIEW,
  },
  review_timestamp: HUMAN_REVIEW.reviewed_at,
  review_timestamp_status: "captured",
  human_review_gate_satisfied: true,
  summary: {
    assertions: assertions.length,
    by_category: Object.fromEntries(["reused_binary", "missing_file", "ordinary_binary_linked"].map((category) => [category, assertions.filter((item) => item.source_assertion.category === category).length])),
    pending_human_review: 0,
    human_reviewed: assertions.length,
    resolved_targets: 0,
    resolved_relationships: 0
  },
  assertions,
  limitations: [
    "The provisional decisions were produced by an AI simulation and remain separately attributed in simulated_review.",
    "A separate attributable human review confirmed all 24 provisional decisions without resolving their targets or relationships.",
    "File availability is a property of the reviewed snapshot and does not establish whether a source record, reference, or document exists elsewhere.",
    "No target, relationship, document identity, binary identity, or open action is inferred beyond the frozen source inventory."
  ]
};
await writeFile(OUTPUT, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: OUTPUT, assertions: assertions.length, status: fixture.status }, null, 2));
