import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withClient } from "./processing-common.mjs";

const INVENTORY = "docs/evaluation/reference-v5-corpus-rollout/inventory-v1.json";
const EXPANSION = "docs/evaluation/reference-extraction-expansion-v1/text-reviewed-fixture-v1.json";
const FOUNDATION = "docs/evaluation/reference-extraction-foundation-fixture/annotations.json";
const OUTPUT = "docs/evaluation/reference-v5-corpus-rollout/audit-sample-v1.json";
const INVENTORY_FINGERPRINT = "9803e4fce557c815754f408a28f523653960eb783c63674d0c5860ed5abe94c0";
const INVENTORY_FILE_SHA256 = "fb392df0ee449f4e90f034c00640f589545d18d06ad7d6cccd541d2d2c8d99e0";
const SEED = "labelled-reference-v5-corpus-audit-v1";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const score = (key) => sha256(`${SEED}\u001f${key}`);
const take = (rows, count) => [...rows].sort((a, b) => score(a.observation_key).localeCompare(score(b.observation_key)) || a.observation_key.localeCompare(b.observation_key)).slice(0, count);

export function selectPredictionAuditSample(predictions, fixtureKeys, reusedBinaryIds, target = 180) {
  const selected = new Map();
  const add = (rows, stratum) => { for (const row of rows) { const entry = selected.get(row.observation_key) ?? { ...row, selection_strata: [] }; if (!entry.selection_strata.includes(stratum)) entry.selection_strata.push(stratum); selected.set(row.observation_key, entry); } };
  add(predictions.filter((row) => row.reference_family === "external_register"), "all_external_register");
  for (const processor of [...new Set(predictions.map((row) => `${row.processor_key}/${row.processor_version}`))].sort()) add(take(predictions.filter((row) => `${row.processor_key}/${row.processor_version}` === processor), 15), `processor:${processor}`);
  for (const family of [...new Set(predictions.map((row) => row.reference_family ?? "unclassified"))].sort()) add(take(predictions.filter((row) => (row.reference_family ?? "unclassified") === family), 15), `family:${family}`);
  for (const rule of [...new Set(predictions.map((row) => row.rule_key))].sort()) add(take(predictions.filter((row) => row.rule_key === rule), 3), `rule:${rule}`);
  const density = new Map([...Map.groupBy(predictions, (row) => row.document_representation_id)].map(([id, rows]) => [id, rows.length]));
  const largestIds = [...density].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 20).map(([id]) => id);
  add(take(predictions.filter((row) => largestIds.includes(row.document_representation_id)), 20), "largest_representations");
  add(take(predictions.filter((row) => fixtureKeys.has(row.observation_key)), 20), "fixture_overlap");
  add(take(predictions.filter((row) => reusedBinaryIds.has(row.file_binary_id)), 20), "reused_binary");
  if (selected.size > target) throw new Error(`STRATIFIED_SAMPLE_EXCEEDS_TARGET:${selected.size}:${target}`);
  add(take(predictions.filter((row) => !selected.has(row.observation_key)), target - selected.size), "seeded_fill");
  return [...selected.values()].map((row) => ({ ...row, selection_strata: row.selection_strata.sort() })).sort((a, b) => score(a.observation_key).localeCompare(score(b.observation_key)) || a.observation_key.localeCompare(b.observation_key));
}

export function verifyAuthorizedInventory(inventoryBytes) {
  if (sha256(inventoryBytes) !== INVENTORY_FILE_SHA256) throw new Error("AUTHORIZED_INVENTORY_FILE_SHA256_MISMATCH");
  const inventory = JSON.parse(inventoryBytes.toString("utf8"));
  if (inventory.deterministic_payload_sha256 !== INVENTORY_FINGERPRINT) throw new Error("AUTHORIZED_INVENTORY_FINGERPRINT_MISMATCH");
  return inventory;
}

function controlsFromFixture(fixture, source, allowedIds = null) {
  const representationHashes = new Map([
    ...(fixture.representations ?? []).map((row) => [Number(row.representation_id), row.representation_content_sha256 ?? row.content_sha256]),
    ...(fixture.ranges ?? []).map((row) => [Number(row.representation_id), row.representation?.content_sha256]),
  ]);
  return fixture.annotations.filter((row) => (!allowedIds || allowedIds.has(row.id)) && (row.polarity === "negative" || row.polarity === "ambiguous")).map((row) => ({ source_fixture: source, annotation_id: row.id, polarity: row.polarity, classification: row.classification, representation_id: row.representation_id, range_key: row.range_key ?? null, char_start: row.char_start, char_end: row.char_end, raw_span: row.raw_span, representation_content_sha256: row.representation_content_sha256 ?? row.representation?.content_sha256 ?? representationHashes.get(Number(row.representation_id)) ?? null }));
}

export async function buildAuditSample(client, { readFile = fs.readFile } = {}) {
  const [inventoryBytes, expansionBytes, foundationBytes] = await Promise.all([readFile(INVENTORY), readFile(EXPANSION), readFile(FOUNDATION)]);
  const inventory = verifyAuthorizedInventory(inventoryBytes);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const [reuseResult, segmentResult] = await Promise.all([
      client.query(`SELECT fb.id AS file_binary_id, COUNT(DISTINCT bd.id)::int AS occurrence_links FROM casework.file_binary fb JOIN casework.document_binary db ON db.file_binary_id=fb.id JOIN casework.bucket_document bd ON bd.document_id=db.document_id GROUP BY fb.id HAVING COUNT(DISTINCT bd.id)>1 ORDER BY fb.id`),
      client.query(`SELECT dr.id AS representation_id, dr.file_binary_id, dr.processor_key, dr.processor_version, ds.id AS document_segment_id, ds.sequence_no, ds.text_content FROM casework.document_representation dr JOIN casework.document_segment ds ON ds.document_representation_id=dr.id WHERE (dr.processor_key,dr.processor_version) IN (('docling','2.123.1-c5.2'),('pdf_literal_text','poppler-layout-v2-c5.3.2'),('xberg','1.0.14-c5.2')) AND COALESCE(ds.text_content,'')<>'' ORDER BY dr.id,ds.sequence_no,ds.id`),
    ]);
    const predictions = inventory.predictions.items;
    const fixtureKeys = new Set(inventory.projected_lifecycle.preexisting_fixture_covered.items);
    const reusedIds = new Set(reuseResult.rows.map((row) => Number(row.file_binary_id)));
    const predictionSample = selectPredictionAuditSample(predictions, fixtureKeys, reusedIds);
    const predictedSegmentIds = new Set(predictions.map((row) => row.document_segment_id));
    const noPrediction = [];
    for (const processor of inventory.processor_allowlist) {
      const rows = segmentResult.rows.filter((row) => row.processor_key === processor.processor_key && row.processor_version === processor.processor_version && !predictedSegmentIds.has(Number(row.document_segment_id))).map((row) => ({ representation_id: Number(row.representation_id), file_binary_id: Number(row.file_binary_id), document_segment_id: Number(row.document_segment_id), segment_sequence_no: Number(row.sequence_no), processor_key: row.processor_key, processor_version: row.processor_version, segment_content_sha256: sha256(Buffer.from(row.text_content, "utf8")), unicode_code_points: [...row.text_content].length, selection_score: score(`no-prediction:${row.document_segment_id}`) }));
      noPrediction.push(...rows.sort((a, b) => a.selection_score.localeCompare(b.selection_score) || a.document_segment_id - b.document_segment_id).slice(0, 10));
    }
    const expansion = JSON.parse(expansionBytes.toString("utf8"));
    const foundation = JSON.parse(foundationBytes.toString("utf8"));
    const exhaustiveFoundationIds = new Set((Array.isArray(foundation.exhaustive_evaluation_scopes) ? foundation.exhaustive_evaluation_scopes : [foundation.exhaustive_evaluation_scopes]).flatMap((scope) => scope?.annotation_ids ?? []));
    const controls = [...controlsFromFixture(expansion, "text-reviewed-fixture-v1"), ...controlsFromFixture(foundation, "reference-extraction-foundation-fixture", exhaustiveFoundationIds)].sort((a, b) => a.source_fixture.localeCompare(b.source_fixture) || a.annotation_id.localeCompare(b.annotation_id));
    if (controls.filter((row) => row.polarity === "negative").length !== 50 || controls.filter((row) => row.polarity === "ambiguous").length !== 3) throw new Error("FROZEN_CONTROL_COUNT_MISMATCH");
    const output = {
      schema_version: 1,
      sample_id: "labelled-reference-v5-corpus-audit-sample-v1",
      selection_seed: SEED,
      authorized_inventory: { path: INVENTORY, file_sha256: sha256(inventoryBytes), deterministic_payload_sha256: INVENTORY_FINGERPRINT },
      selection_rules: { prediction_target: 180, processor_quota: 15, extractor_family_quota: 15, extractor_rule_quota: 3, largest_representation_quota: 20, fixture_overlap_quota: 20, reused_binary_quota: 20, all_external_register: true, seeded_fill_to_target: true, no_prediction_segment_quota_per_processor: 10 },
      prediction_sample: predictionSample,
      no_prediction_segment_controls: noPrediction,
      protected_fixture_controls: controls,
      summary: {
        prediction_sample: predictionSample.length,
        processors: [...new Set(predictionSample.map((row) => `${row.processor_key}/${row.processor_version}`))].length,
        extractor_families: Object.fromEntries([...Map.groupBy(predictionSample, (row) => row.reference_family ?? "unclassified")].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => [key, rows.length])),
        role_hints: Object.fromEntries([...Map.groupBy(predictionSample, (row) => row.role_hint ?? "unclassified")].sort(([a], [b]) => a.localeCompare(b)).map(([key, rows]) => [key, rows.length])),
        fixture_overlap: predictionSample.filter((row) => fixtureKeys.has(row.observation_key)).length,
        reused_binary: predictionSample.filter((row) => reusedIds.has(row.file_binary_id)).length,
        no_prediction_segments: noPrediction.length,
        protected_negative: controls.filter((row) => row.polarity === "negative").length,
        protected_ambiguous: controls.filter((row) => row.polarity === "ambiguous").length,
      },
      acceptance: {
        prediction_false_positive_rate_max: 0.02,
        prediction_false_positive_count_max: 3,
        provenance_error_count_max: 0,
        protected_negative_overlap_count_max: 0,
        ambiguous_cases_scored: false,
        no_prediction_controls: "reviewed for missed in-scope v5 surface forms; any confirmed miss blocks write authorization",
      },
      hard_ceilings: { predicted_observations: 16465, projected_new_inserts: 16354, batches: 33, observations_per_batch: 500, serialized_prediction_bytes: 15851473, observations_per_representation: 332, observations_per_binary: 964, lifecycle_mutations_other_than_inserts: 0, blocked_or_collision_cases: 0 },
      stop_conditions: ["AUTHORIZED_INVENTORY_FINGERPRINT_MISMATCH", "IDENTITY_COLLISION", "FIXTURE_PROVENANCE_MISMATCH", "OWNERSHIP_FAILURE", "UNEXPECTED_LIFECYCLE_CHANGE", "PROVENANCE_ERROR", "HARD_CEILING_EXCEEDED", "PROTECTED_NEGATIVE_MATCH"],
      review_state: "frozen_selection_pending_human_audit",
    };
    await client.query("ROLLBACK");
    return output;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}

async function main() { await withClient("reference-v5-corpus-audit-sample", async (client) => { const output = await buildAuditSample(client); await fs.mkdir(path.dirname(OUTPUT), { recursive: true }); await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8"); console.log(JSON.stringify({ output: OUTPUT, summary: output.summary, review_state: output.review_state }, null, 2)); }); }
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
