import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withClient } from "./processing-common.mjs";
import { buildV5ObservationKey, IDENTITY_VERSION, NORMALIZATION_IDENTITY } from "./reference-v5-ingestion.mjs";
import { extractLabelledReferences, normalizeReferenceValue, REFERENCE_EXTRACTOR_KEY, REFERENCE_EXTRACTOR_VERSION } from "./reference-search-store.mjs";

export const INVENTORY_VERSION = "labelled-reference-v5-corpus-inventory-v1";
export const CORPUS_SCOPE = "labelled-reference-v5-corpus-rollout-v1";
export const DEFAULT_OUTPUT = "docs/evaluation/reference-v5-corpus-rollout/inventory-v1.json";
export const BATCH_TARGET = 500;
export const PROCESSOR_ALLOWLIST = [
  ["docling", "2.123.1-c5.2"],
  ["pdf_literal_text", "poppler-layout-v2-c5.3.2"],
  ["xberg", "1.0.14-c5.2"],
];
const allowlistKey = (key, version) => `${key}\u001f${version}`;
const allowed = new Set(PROCESSOR_ALLOWLIST.map(([key, version]) => allowlistKey(key, version)));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const codePoints = (value) => [...String(value ?? "")];
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const canonicalJson = (value) => JSON.stringify(value, (_, nested) => nested && typeof nested === "object" && !Array.isArray(nested)
  ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right))) : nested);
const percentile = (values, p) => values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] : 0;
const groupCounts = (items, keyFn) => Object.fromEntries([...Map.groupBy(items, keyFn)].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([key, rows]) => [key, rows.length]));

function mapSpan(segments, start, end) {
  let cursor = 0;
  for (const segment of segments) {
    const length = codePoints(segment.text_content).length;
    if (start >= cursor && end <= cursor + length) return { segment, start: start - cursor, end: end - cursor, base: cursor };
    cursor += length + 1;
  }
  return null;
}

export function classifyRepresentations(rows) {
  const grouped = Map.groupBy(rows, (row) => Number(row.representation_id));
  const eligible = [], exclusions = [];
  for (const [representationId, segments] of grouped) {
    const head = segments[0];
    if (!allowed.has(allowlistKey(head.processor_key, head.processor_version))) {
      exclusions.push({ representation_id: representationId, file_binary_id: Number(head.file_binary_id), processor_key: head.processor_key, processor_version: head.processor_version, reason_code: "PROCESSOR_IDENTITY_NOT_ALLOWLISTED" });
    } else if (!segments.some((row) => String(row.text_content ?? "") !== "")) {
      exclusions.push({ representation_id: representationId, file_binary_id: Number(head.file_binary_id), processor_key: head.processor_key, processor_version: head.processor_version, reason_code: "NO_NONEMPTY_STORED_SEGMENT" });
    } else eligible.push({ representation_id: representationId, file_binary_id: Number(head.file_binary_id), processor_key: head.processor_key, processor_version: head.processor_version, segments });
  }
  return { eligible, exclusions };
}

export function extractInventoryPredictions(eligible) {
  const predictions = [];
  for (const representation of eligible) {
    const text = representation.segments.map((row) => row.text_content ?? "").join("\n");
    const representationHash = sha256(Buffer.from(text, "utf8"));
    for (const prediction of extractLabelledReferences(text)) {
      const mapped = mapSpan(representation.segments, prediction.char_start, prediction.char_end);
      const labelMapped = mapSpan(representation.segments, prediction.label_provenance.label_char_start, prediction.label_provenance.label_char_end);
      if (!mapped || !labelMapped || mapped.segment.document_segment_id !== labelMapped.segment.document_segment_id) throw new Error(`UNMAPPABLE_CORPUS_SPAN:${representation.representation_id}:${prediction.char_start}`);
      const segmentText = mapped.segment.text_content ?? "";
      const item = {
        file_binary_id: representation.file_binary_id,
        document_representation_id: representation.representation_id,
        document_segment_id: Number(mapped.segment.document_segment_id),
        segment_sequence_no: Number(mapped.segment.sequence_no),
        processor_key: representation.processor_key,
        processor_version: representation.processor_version,
        representation_content_sha256: representationHash,
        segment_content_sha256: sha256(Buffer.from(segmentText, "utf8")),
        representation_char_start: prediction.char_start,
        representation_char_end: prediction.char_end,
        char_start: mapped.start,
        char_end: mapped.end,
        raw_value: prediction.raw_value,
        normalized_value: normalizeReferenceValue(prediction.raw_value),
        raw_label: prediction.raw_label,
        rule_key: prediction.rule_key,
        reference_family: prediction.reference_family ?? null,
        role_hint: prediction.role_hint,
        parsed_candidate: Object.fromEntries(Object.entries(prediction).filter(([key]) => key.startsWith("parsed_"))),
        label_provenance: {
          ...prediction.label_provenance,
          representation_label_char_start: prediction.label_provenance.label_char_start,
          representation_label_char_end: prediction.label_provenance.label_char_end,
          label_char_start: prediction.label_provenance.label_char_start - mapped.base,
          label_char_end: prediction.label_provenance.label_char_end - mapped.base,
        },
      };
      item.observation_key = buildV5ObservationKey(item);
      predictions.push(item);
    }
  }
  return predictions.sort((a, b) => a.processor_key.localeCompare(b.processor_key)
    || a.processor_version.localeCompare(b.processor_version)
    || a.file_binary_id - b.file_binary_id
    || a.document_representation_id - b.document_representation_id
    || a.segment_sequence_no - b.segment_sequence_no
    || a.document_segment_id - b.document_segment_id
    || a.char_start - b.char_start || a.char_end - b.char_end
    || a.observation_key.localeCompare(b.observation_key));
}

function canonicalProvenanceMatches(item, row) {
  const metadata = row.metadata_json ?? {};
  const expectedLabel = Object.fromEntries(Object.entries(item.label_provenance).filter(([key]) => !key.startsWith("representation_label_")));
  const actual = {
    observed_in_kind: row.observed_in_kind,
    file_binary_id: Number(row.file_binary_id), document_representation_id: Number(row.document_representation_id), document_segment_id: Number(row.document_segment_id),
    char_start: Number(row.char_start), char_end: Number(row.char_end), raw_value: row.raw_value, normalized_value: row.normalized_value,
    raw_label: row.raw_label, observer_version: row.observer_version, role_hint: row.role_hint,
    namespace_hint: row.namespace_hint ?? null, target_candidates: row.target_candidates_json ?? [], confidence: row.confidence,
    observation_identity_version: metadata.observation_identity_version, normalization_identity: metadata.normalization_identity,
    representation_content_sha256: metadata.representation_content_sha256, segment_content_sha256: metadata.segment_content_sha256,
    representation_char_start: Number(metadata.representation_char_start), representation_char_end: Number(metadata.representation_char_end),
    segment_char_start: Number(metadata.segment_char_start), segment_char_end: Number(metadata.segment_char_end), extractor_rule_key: metadata.extractor_rule_key,
    reference_family: metadata.reference_family ?? null, parsed_candidate: metadata.parsed_candidate ?? {}, label_provenance: metadata.label_provenance ?? {},
    target_resolution: metadata.target_resolution, document_identity: metadata.document_identity, binary_identity: metadata.binary_identity,
  };
  const expected = {
    observed_in_kind: "segment",
    file_binary_id: item.file_binary_id, document_representation_id: item.document_representation_id, document_segment_id: item.document_segment_id,
    char_start: item.char_start, char_end: item.char_end, raw_value: item.raw_value, normalized_value: item.normalized_value,
    raw_label: item.raw_label, observer_version: REFERENCE_EXTRACTOR_VERSION, role_hint: item.role_hint,
    namespace_hint: null, target_candidates: [], confidence: "high",
    observation_identity_version: IDENTITY_VERSION, normalization_identity: NORMALIZATION_IDENTITY,
    representation_content_sha256: item.representation_content_sha256, segment_content_sha256: item.segment_content_sha256,
    representation_char_start: item.representation_char_start, representation_char_end: item.representation_char_end,
    segment_char_start: item.char_start, segment_char_end: item.char_end, extractor_rule_key: item.rule_key,
    reference_family: item.reference_family ?? null, parsed_candidate: item.parsed_candidate, label_provenance: expectedLabel,
    target_resolution: "unresolved", document_identity: "unresolved", binary_identity: "unresolved",
  };
  return canonicalJson(actual) === canonicalJson(expected);
}

export function buildEligibilityEvidence(eligible) {
  return new Map(eligible.map((representation) => {
    const text = representation.segments.map((row) => row.text_content ?? "").join("\n");
    return [representation.representation_id, {
      representation_content_sha256: sha256(Buffer.from(text, "utf8")),
      segments: new Map(representation.segments.map((segment) => [Number(segment.document_segment_id), sha256(Buffer.from(segment.text_content ?? "", "utf8"))])),
    }];
  }));
}

export function planCorpusLifecycle(predictions, existing, eligibilityEvidence = new Map()) {
  const byKey = Map.groupBy(existing, (row) => row.observation_key);
  const bySpan = Map.groupBy(existing, (row) => [row.file_binary_id, row.document_representation_id, row.document_segment_id, row.char_start, row.char_end].join(":"));
  const desiredKeys = new Set(predictions.map((row) => row.observation_key));
  const categories = Object.fromEntries(["preexisting_fixture_covered", "preexisting_corpus_unchanged", "insert", "reactivate", "supersede", "retire_source_absent", "retained_excluded_or_unverified", "blocked"].map((key) => [key, []]));
  for (const item of predictions) {
    const exact = byKey.get(item.observation_key) ?? [];
    if (exact.length > 1) { categories.blocked.push({ observation_key: item.observation_key, reason_code: "DUPLICATE_OBSERVATION_KEY" }); continue; }
    const row = exact[0];
    if (row?.metadata_json?.fixture_scope === "frozen-v5-expansion-and-foundation") {
      if (row.lifecycle_state !== "current") categories.blocked.push({ observation_key: item.observation_key, reason_code: "FIXTURE_OBSERVATION_NOT_CURRENT", prior_id: Number(row.id) });
      else if (!canonicalProvenanceMatches(item, row)) categories.blocked.push({ observation_key: item.observation_key, reason_code: "FIXTURE_PROVENANCE_MISMATCH", prior_id: Number(row.id) });
      else categories.preexisting_fixture_covered.push(item.observation_key);
    } else if (row?.metadata_json?.corpus_rollout_scope === CORPUS_SCOPE) {
      if (!canonicalProvenanceMatches(item, row)) categories.blocked.push({ observation_key: item.observation_key, reason_code: "CORPUS_PROVENANCE_MISMATCH", prior_id: Number(row.id) });
      else if (row.lifecycle_state === "current") categories.preexisting_corpus_unchanged.push(item.observation_key);
      else categories.reactivate.push({ observation_key: item.observation_key, prior_id: Number(row.id) });
    } else if (row) categories.blocked.push({ observation_key: item.observation_key, reason_code: "EXACT_KEY_FOREIGN_OR_UNOWNED", prior_id: Number(row.id) });
    else {
      const span = [item.file_binary_id, item.document_representation_id, item.document_segment_id, item.char_start, item.char_end].join(":");
      const predecessors = (bySpan.get(span) ?? []).filter((candidate) => candidate.lifecycle_state === "current");
      if (predecessors.length > 1) categories.blocked.push({ observation_key: item.observation_key, reason_code: "AMBIGUOUS_CURRENT_PREDECESSOR", predecessor_ids: predecessors.map((candidate) => Number(candidate.id)) });
      else {
        categories.insert.push(item.observation_key);
        if (predecessors.length === 1) categories.supersede.push({ observation_key: predecessors[0].observation_key, replacement_key: item.observation_key, prior_id: Number(predecessors[0].id) });
      }
    }
  }
  for (const row of existing) if (row.lifecycle_state === "current" && row.metadata_json?.corpus_rollout_scope === CORPUS_SCOPE && !desiredKeys.has(row.observation_key)) {
    const evidence = eligibilityEvidence.get(Number(row.document_representation_id));
    if (!evidence) categories.retained_excluded_or_unverified.push({ observation_key: row.observation_key, prior_id: Number(row.id), reason_code: "SOURCE_REPRESENTATION_NOT_ELIGIBLE" });
    else if (evidence.representation_content_sha256 !== row.metadata_json?.representation_content_sha256
      || evidence.segments.get(Number(row.document_segment_id)) !== row.metadata_json?.segment_content_sha256) categories.blocked.push({ observation_key: row.observation_key, prior_id: Number(row.id), reason_code: "SOURCE_HASH_DRIFT" });
    else categories.retire_source_absent.push({ observation_key: row.observation_key, prior_id: Number(row.id) });
  }
  return categories;
}

function makeBatches(predictions, planFingerprint) {
  const batches = [];
  for (let start = 0; start < predictions.length; start += BATCH_TARGET) {
    const rows = predictions.slice(start, start + BATCH_TARGET);
    batches.push({
      batch_index: batches.length,
      item_count: rows.length,
      first_observation_key: rows[0]?.observation_key ?? null,
      last_observation_key: rows.at(-1)?.observation_key ?? null,
      batch_id: sha256(`${INVENTORY_VERSION}\u001f${planFingerprint}\u001f${rows[0]?.observation_key ?? ""}\u001f${rows.at(-1)?.observation_key ?? ""}\u001f${rows.length}`),
      serialized_prediction_bytes: Buffer.byteLength(JSON.stringify(rows), "utf8"),
    });
  }
  return batches;
}

export async function buildCorpusInventory(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const snapshotTime = (await client.query("SELECT transaction_timestamp() AS value")).rows[0].value;
    const [representationResult, existingResult] = await Promise.all([
      client.query(`SELECT dr.id AS representation_id, dr.file_binary_id, dr.processor_key, dr.processor_version, ds.id AS document_segment_id, ds.sequence_no, ds.text_content FROM casework.document_representation dr LEFT JOIN casework.document_segment ds ON ds.document_representation_id=dr.id ORDER BY dr.id, ds.sequence_no, ds.id`),
      client.query(`SELECT ro.*, EXISTS(SELECT 1 FROM casework.reference_observation_review rv WHERE rv.reference_observation_id=ro.id) AS has_review FROM casework.reference_observation ro WHERE ro.observer_key=$1 ORDER BY ro.id`, [REFERENCE_EXTRACTOR_KEY]),
    ]);
    const { eligible, exclusions } = classifyRepresentations(representationResult.rows);
    const predictions = extractInventoryPredictions(eligible);
    const lifecycle = planCorpusLifecycle(predictions, existingResult.rows, buildEligibilityEvidence(eligible));
    const duplicateKeys = [...Map.groupBy(predictions, (row) => row.observation_key)].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ observation_key: key, count: rows.length }));
    const perRepresentation = [...Map.groupBy(predictions, (row) => row.document_representation_id)].map(([id, rows]) => ({ id, count: rows.length })).sort((a, b) => a.count - b.count || a.id - b.id);
    const perSegment = [...Map.groupBy(predictions, (row) => row.document_segment_id)].map(([id, rows]) => ({ id, count: rows.length })).sort((a, b) => a.count - b.count || a.id - b.id);
    const perBinary = [...Map.groupBy(predictions, (row) => row.file_binary_id)].map(([id, rows]) => ({ id, count: rows.length })).sort((a, b) => a.count - b.count || a.id - b.id);
    const deterministicCore = {
      inventory_version: INVENTORY_VERSION,
      corpus_rollout_scope: CORPUS_SCOPE,
      extractor: { key: REFERENCE_EXTRACTOR_KEY, version: REFERENCE_EXTRACTOR_VERSION, function_source_sha256: sha256(extractLabelledReferences.toString()), identity_version: IDENTITY_VERSION, normalization_identity: NORMALIZATION_IDENTITY },
      processor_allowlist: PROCESSOR_ALLOWLIST.map(([processor_key, processor_version]) => ({ processor_key, processor_version })),
      eligibility: {
        representations: eligible.length,
        binaries: new Set(eligible.map((row) => row.file_binary_id)).size,
        segments: eligible.reduce((sum, row) => sum + row.segments.length, 0),
        nonempty_segments: eligible.reduce((sum, row) => sum + row.segments.filter((segment) => String(segment.text_content ?? "") !== "").length, 0),
        characters: eligible.reduce((sum, row) => sum + row.segments.reduce((inner, segment) => inner + codePoints(segment.text_content).length, 0), 0),
      },
      exclusions: { count: exclusions.length, by_reason: groupCounts(exclusions, (row) => row.reason_code), items: exclusions },
      predictions: {
        count: predictions.length,
        distinct_observation_keys: new Set(predictions.map((row) => row.observation_key)).size,
        duplicate_keys: duplicateKeys,
        by_processor: groupCounts(predictions, (row) => `${row.processor_key}/${row.processor_version}`),
        by_rule: groupCounts(predictions, (row) => row.rule_key),
        by_family: groupCounts(predictions, (row) => row.reference_family ?? "unclassified"),
        by_role_hint: groupCounts(predictions, (row) => row.role_hint ?? "unclassified"),
        distinct_representations: new Set(predictions.map((row) => row.document_representation_id)).size,
        distinct_binaries: new Set(predictions.map((row) => row.file_binary_id)).size,
        distribution: {
          representation: { p95: percentile(perRepresentation.map((row) => row.count), .95), p99: percentile(perRepresentation.map((row) => row.count), .99), max: perRepresentation.at(-1)?.count ?? 0 },
          segment: { p95: percentile(perSegment.map((row) => row.count), .95), p99: percentile(perSegment.map((row) => row.count), .99), max: perSegment.at(-1)?.count ?? 0 },
          binary: { p95: percentile(perBinary.map((row) => row.count), .95), p99: percentile(perBinary.map((row) => row.count), .99), max: perBinary.at(-1)?.count ?? 0 },
        },
        items: predictions,
      },
      projected_lifecycle: Object.fromEntries(Object.entries(lifecycle).map(([key, rows]) => [key, { count: rows.length, items: rows }])),
    };
    const planFingerprint = sha256(stableJson(deterministicCore));
    const batches = makeBatches(predictions, planFingerprint);
    const payloadBytes = Buffer.byteLength(JSON.stringify(predictions), "utf8");
    const output = {
      ...deterministicCore,
      deterministic_payload_sha256: planFingerprint,
      database_snapshot_time: new Date(snapshotTime).toISOString(),
      read_only_guarantee: { transaction: "REPEATABLE READ READ ONLY", mutation_statements_issued: false, sequence_functions_called: false },
      projected_storage: { serialized_prediction_bytes: payloadBytes, database_overhead: "not estimated; PostgreSQL tuple, index, JSONB, and lifecycle overhead require later measured canary evidence" },
      batches: { target_items: BATCH_TARGET, count: batches.length, items: batches },
      proposed_write_ceilings: { status: "pending_independent_review", basis: "measured inventory p95, p99, maxima, lifecycle counts, and serialized payload" },
    };
    await client.query("ROLLBACK");
    return output;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  await withClient("reference-v5-corpus-inventory", async (client) => {
    const report = await buildCorpusInventory(client);
    const serialized = stableJson(report);
    if (outputPath) { await fs.mkdir(path.dirname(outputPath), { recursive: true }); await fs.writeFile(outputPath, serialized, "utf8"); }
    console.log(outputPath ? JSON.stringify({
      output: outputPath,
      deterministic_payload_sha256: report.deterministic_payload_sha256,
      eligible_representations: report.eligibility.representations,
      predicted_observations: report.predictions.count,
      projected_lifecycle: Object.fromEntries(Object.entries(report.projected_lifecycle).map(([key, value]) => [key, value.count])),
      batches: report.batches.count,
    }, null, 2) : serialized);
  });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1; });
