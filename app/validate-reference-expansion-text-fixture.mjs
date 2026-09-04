import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const fixturePath = new URL("../docs/evaluation/reference-extraction-expansion-v1/text-reviewed-fixture-v1.json", import.meta.url);
const selectionPath = new URL("../docs/evaluation/reference-extraction-expansion-v1/text-selection.json", import.meta.url);
const fixtureRaw = await readFile(fixturePath, "utf8");
const selectionRaw = await readFile(selectionPath, "utf8");
const fixture = JSON.parse(fixtureRaw);
const selection = JSON.parse(selectionRaw);
const apiBase = process.env.CONSULTATION_API_BASE ?? "http://127.0.0.1:8091";
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const cp = (value) => Array.from(value);
const fail = (message) => { throw new Error(message); };

if (fixture.selection_fixture_sha256 !== sha256(selectionRaw)) fail("Frozen text-selection hash changed");
if (fixture.summary.ranges !== 12 || fixture.summary.annotations !== 131 || fixture.summary.positive !== 93 || fixture.summary.negative !== 35 || fixture.summary.ambiguous !== 3) fail("Frozen summary totals changed");
if (new Set(fixture.annotations.map(({ id }) => id)).size !== fixture.annotations.length) fail("Duplicate annotation IDs");
if (fixture.status !== "reviewed_frozen") fail("Fixture is not frozen");
if (fixture.review_sessions.length !== 1 || fixture.review_sessions[0].reviewer_identity !== "case_support_reviewer_attila_test_1") fail("Unexpected review provenance");
if (fixture.independent_verification_sessions?.length !== 1) fail("Missing independent verification session");
const independentReview = fixture.independent_verification_sessions[0];
if (independentReview.reviewer_identity !== "codex_root_independent_fixture_review_v1" || independentReview.method !== "independent_complete_range_semantic_audit" || independentReview.decision !== "candidate_completeness_confirmed") fail("Unexpected independent verification provenance");
if (independentReview.reviewed_at !== null || independentReview.reviewed_at_status !== "unavailable_not_captured") fail("Independent-review timestamp must remain honestly unavailable");
if (independentReview.findings.length !== 0 || !Object.values(independentReview.confirmation).every(Boolean)) fail("Independent completeness confirmation is incomplete");
if (fixture.review_sessions[0].reviewed_at !== null || fixture.review_sessions[0].reviewed_at_status !== "unavailable_not_captured") fail("Review timestamp must remain honestly unavailable");

const selectionRanges = new Map(selection.ranges.map((range) => [range.range_key, range]));
const fixtureRanges = new Map(fixture.ranges.map((range) => [range.range_key, range]));
if (fixtureRanges.size !== selectionRanges.size) fail("Fixture range set differs from frozen selection");
const expectedRangeCounts = [2, 2, 1, 2, 60, 2, 44, 6, 2, 2, 1, 7];
const representationContent = new Map();

for (let rangeIndex = 0; rangeIndex < selection.ranges.length; rangeIndex += 1) {
  const selected = selection.ranges[rangeIndex];
  const range = fixtureRanges.get(selected.range_key) ?? fail(`Missing range ${selected.range_key}`);
  for (const key of ["representation_id", "char_start", "char_end", "boundary_kind", "code_point_count"]) {
    if (range[key] !== selected[key]) fail(`Range ${selected.range_key} changed ${key}`);
  }
  if (range.completeness.status !== "exhaustive" || range.completeness.reviewer_attested_no_intentional_omissions !== true) fail(`Range ${selected.range_key} is not exhaustively attested`);
  let content = representationContent.get(range.representation_id);
  if (!content) {
    const response = await fetch(`${apiBase}/api/consultation/representations/${range.representation_id}/content?format=text`);
    if (!response.ok) fail(`Representation ${range.representation_id}: HTTP ${response.status}`);
    content = await response.text();
    representationContent.set(range.representation_id, content);
  }
  if (sha256(content) !== range.representation.content_sha256) fail(`Representation ${range.representation_id} content hash mismatch`);
  const chars = cp(content);
  const rangeText = chars.slice(range.char_start, range.char_end).join("");
  if (sha256(rangeText) !== range.range_content_sha256) fail(`Range ${range.range_key} content hash mismatch`);
  const annotations = fixture.annotations.filter((annotation) => annotation.range_key === range.range_key);
  if (annotations.length !== expectedRangeCounts[rangeIndex]) fail(`Range ${range.range_key}: expected ${expectedRangeCounts[rangeIndex]} reviewed candidates, got ${annotations.length}`);
  const memberIds = range.completeness.annotation_ids;
  if (memberIds.length !== annotations.length || memberIds.some((id, index) => id !== annotations[index].id)) fail(`Range ${range.range_key} completeness membership mismatch`);
  const ordered = [...annotations].sort((a, b) => a.char_start - b.char_start || a.char_end - b.char_end);
  for (let index = 0; index < ordered.length; index += 1) {
    const annotation = ordered[index];
    if (annotation.representation_id !== range.representation_id || annotation.char_start < range.char_start || annotation.char_end > range.char_end) fail(`${annotation.id} is outside its exhaustive range`);
    if (chars.slice(annotation.char_start, annotation.char_end).join("") !== annotation.raw_span) fail(`${annotation.id} raw span mismatch`);
    if (annotation.bounded_context.char_start > annotation.char_start || annotation.bounded_context.char_end < annotation.char_end) fail(`${annotation.id} context does not contain span`);
    if (chars.slice(annotation.bounded_context.char_start, annotation.bounded_context.char_end).join("") !== annotation.bounded_context.text) fail(`${annotation.id} context mismatch`);
    if (index > 0 && ordered[index - 1].char_end > annotation.char_start) fail(`${annotation.id} overlaps ${ordered[index - 1].id}`);
    if (annotation.review_state !== "human_reviewed" || annotation.human_review.session_id !== fixture.review_sessions[0].session_id) fail(`${annotation.id} review provenance mismatch`);
  }
}

const verifiedRangeKeys = independentReview.confirmed_range_keys;
if (verifiedRangeKeys.length !== fixture.ranges.length || verifiedRangeKeys.some((key, index) => key !== fixture.ranges[index].range_key)) fail("Independent range verification membership mismatch");
const verifiedAnnotationIds = independentReview.confirmed_annotation_ids;
if (verifiedAnnotationIds.length !== fixture.annotations.length || verifiedAnnotationIds.some((id, index) => id !== fixture.annotations[index].id)) fail("Independent annotation verification membership mismatch");

const sessionIds = fixture.review_sessions[0].reviewed_annotation_ids;
if (sessionIds.length !== fixture.annotations.length || sessionIds.some((id, index) => id !== fixture.annotations[index].id)) fail("Review-session membership mismatch");
if (fixture.taxonomy_boundary.internal_document_section_reference !== "out_of_scope_negative") fail("Internal-section taxonomy boundary changed");
if (!fixture.taxonomy_boundary.absent_families.every((family) => selection.summary.family_evaluation_state[family] === "not_evaluated")) fail("Absent-family state is inconsistent with selection");

console.log(JSON.stringify({
  valid: true,
  fixture_sha256: sha256(fixtureRaw),
  selection_sha256: sha256(selectionRaw),
  representations_verified: representationContent.size,
  ranges_verified_exhaustive: fixture.ranges.length,
  annotations_verified: fixture.annotations.length,
  polarity: { positive: 93, negative: 35, ambiguous: 3 },
  extractor_run: false,
  database_writes: false
}, null, 2));
