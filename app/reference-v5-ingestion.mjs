import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withClient } from "./processing-common.mjs";
import { buildObservationKey, normalizeReferenceValue, REFERENCE_EXTRACTOR_KEY, REFERENCE_EXTRACTOR_VERSION } from "./reference-search-store.mjs";

export const IDENTITY_VERSION = "reference-text-observation-identity-v1";
export const NORMALIZATION_IDENTITY = "reference-normalization-nfkc-upper-v1";
export const INGESTER_KEY = "app/reference-v5-ingestion.mjs";
export const INGESTER_VERSION = "v1";
const EXPANSION = "docs/evaluation/reference-extraction-expansion-v1/labelled-reference-v5-evaluation.json";
const FOUNDATION = "docs/evaluation/reference-extraction-foundation-deterministic-v5.json";

const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");
const emptyCounts = () => ({ insert: 0, unchanged: 0, supersede: 0, retire_source_absent: 0, retire_out_of_frozen_scope: 0, reactivate: 0, reconcile_legacy_identity: 0, retained_reviewed_history: 0 });

export function buildV5ObservationKey(item) {
  return sha256([
    REFERENCE_EXTRACTOR_KEY, REFERENCE_EXTRACTOR_VERSION, "segment",
    item.file_binary_id, item.document_representation_id, item.document_segment_id,
    item.representation_content_sha256, item.char_start, item.char_end,
    item.raw_value, item.normalized_value, item.raw_label, item.rule_key,
    item.label_provenance.kind, item.label_provenance.label_char_start,
    item.label_provenance.label_char_end,
  ].map((value) => value ?? "").join("\u001f"));
}

function codePoints(value) { return [...String(value ?? "")]; }
function context(text, start, end, radius = 90) {
  return codePoints(text).slice(Math.max(0, start - radius), end + radius).join("").replace(/\s+/gu, " ").trim();
}

function mapSpan(segments, start, end) {
  let cursor = 0;
  for (const segment of segments) {
    const length = codePoints(segment.text_content).length;
    if (start >= cursor && end <= cursor + length) return { segment, start: start - cursor, end: end - cursor, base: cursor };
    cursor += length + 1;
  }
  return null;
}

function expectedHash(input, representationId) {
  if (input.fixture?.scope_id) return input.input.representation_content_sha256;
  return input.inputs.find((item) => Number(item.representation_id) === Number(representationId))?.representation_content_sha256;
}

export async function loadFrozenPredictions(readFile = fs.readFile) {
  const [expansionBytes, foundationBytes] = await Promise.all([readFile(EXPANSION), readFile(FOUNDATION)]);
  const expansion = JSON.parse(expansionBytes.toString("utf8"));
  const foundation = JSON.parse(foundationBytes.toString("utf8"));
  const checks = [
    [expansion, 93, 35, 3], [foundation, 18, 15, 0],
  ];
  for (const [artifact, positives, negatives, ambiguous] of checks) {
    const summary = artifact.summary.overall ?? artifact.summary;
    if (summary.exact !== positives || summary.missed !== 0 || summary.partial_or_overlapping !== 0) throw new Error("FROZEN_EVALUATION_NOT_EXACT");
    const negativeCount = artifact.summary.reviewed_negative_count ?? artifact.summary.reviewed_date_negative_count;
    if (negativeCount !== negatives) throw new Error("FROZEN_CONTROL_COUNT_MISMATCH");
    if ((artifact.summary.reviewed_ambiguous_count ?? 0) !== ambiguous) throw new Error("FROZEN_AMBIGUOUS_COUNT_MISMATCH");
    if ((artifact.summary.predictions_overlapping_negatives ?? artifact.summary.predictions_overlapping_date_negatives) !== 0) throw new Error("FROZEN_NEGATIVE_OVERLAP");
  }
  return { artifacts: [expansion, foundation], predictions: [...expansion.predictions, ...foundation.predictions], controls: { positives: 111, negatives: 50, ambiguous: 3 } };
}

async function materialize(client) {
  const frozen = await loadFrozenPredictions();
  const ids = [...new Set(frozen.predictions.map((item) => Number(item.representation_id ?? frozen.artifacts[1].input.representation_id)))];
  const result = await client.query(`
    SELECT dr.id AS representation_id, dr.file_binary_id, dr.processor_key, dr.processor_version,
           ds.id AS document_segment_id, ds.sequence_no, ds.text_content, ds.page_no
    FROM casework.document_representation dr
    JOIN casework.document_segment ds ON ds.document_representation_id=dr.id
    WHERE dr.id = ANY($1::bigint[]) ORDER BY dr.id, ds.sequence_no
  `, [ids]);
  const byRepresentation = Map.groupBy(result.rows, (row) => Number(row.representation_id));
  const desired = [];
  for (const artifact of frozen.artifacts) for (const prediction of artifact.predictions) {
    const representationId = Number(prediction.representation_id ?? artifact.input.representation_id);
    const segments = byRepresentation.get(representationId) ?? [];
    const representationText = segments.map((row) => row.text_content ?? "").join("\n");
    const hash = sha256(representationText);
    if (hash !== expectedHash(artifact, representationId)) throw new Error(`REPRESENTATION_HASH_MISMATCH:${representationId}`);
    if (codePoints(representationText).slice(prediction.char_start, prediction.char_end).join("") !== prediction.raw_value) throw new Error(`RAW_SPAN_MISMATCH:${representationId}:${prediction.char_start}`);
    const mapped = mapSpan(segments, prediction.char_start, prediction.char_end);
    const labelMapped = mapSpan(segments, prediction.label_provenance.label_char_start, prediction.label_provenance.label_char_end);
    if (!mapped || !labelMapped || mapped.segment.document_segment_id !== labelMapped.segment.document_segment_id) throw new Error(`UNMAPPABLE_SPAN:${representationId}:${prediction.char_start}`);
    const segmentText = mapped.segment.text_content ?? "";
    const label = { ...prediction.label_provenance, label_char_start: prediction.label_provenance.label_char_start - mapped.base, label_char_end: prediction.label_provenance.label_char_end - mapped.base };
    if (codePoints(segmentText).slice(label.label_char_start, label.label_char_end).join("") !== label.source_label) throw new Error(`LABEL_SPAN_MISMATCH:${representationId}:${prediction.char_start}`);
    const item = {
      ...prediction, file_binary_id: Number(mapped.segment.file_binary_id), document_representation_id: representationId,
      document_segment_id: Number(mapped.segment.document_segment_id), page_no: mapped.segment.page_no,
      char_start: mapped.start, char_end: mapped.end, label_provenance: label,
      representation_char_start: prediction.char_start, representation_char_end: prediction.char_end,
      representation_content_sha256: hash, segment_content_sha256: sha256(segmentText),
      normalized_value: normalizeReferenceValue(prediction.raw_value), context_text: context(segmentText, mapped.start, mapped.end),
    };
    item.observation_key = buildV5ObservationKey(item);
    desired.push(item);
  }
  if (desired.length !== 111 || new Set(desired.map((item) => item.observation_key)).size !== 111) throw new Error("INVALID_DESIRED_IDENTITY_COUNT");
  return { desired, controls: frozen.controls };
}

const EXISTING_SQL = `SELECT ro.*, EXISTS(SELECT 1 FROM casework.reference_observation_review r WHERE r.reference_observation_id=ro.id) AS has_review FROM casework.reference_observation ro WHERE ro.observer_key=$1 ORDER BY ro.id`;
function spanKey(item) { return [item.file_binary_id,item.document_representation_id,item.document_segment_id,item.char_start,item.char_end].join(":"); }
function legacyKey(item) { return buildObservationKey({ ...item, observed_in_kind: "segment", observer_key: REFERENCE_EXTRACTOR_KEY, observer_version: REFERENCE_EXTRACTOR_VERSION }); }

export function planV5Ingestion(desired, existing) {
  const byKey = new Map(existing.map((row) => [row.observation_key, row]));
  const bySpan = Map.groupBy(existing, spanKey);
  const operations = [], desiredKeys = new Set(desired.map((item) => item.observation_key)), handledLegacyIds = new Set();
  for (const item of desired) {
    const exact = byKey.get(item.observation_key);
    const candidates = (bySpan.get(spanKey(item)) ?? []).filter((row) => row.lifecycle_state === "current" && row.id !== exact?.id);
    const possibleLegacy = candidates.filter((row) => row.observer_version === REFERENCE_EXTRACTOR_VERSION && !row.metadata_json?.observation_identity_version
      && row.normalized_value === item.normalized_value && row.raw_label === item.raw_label);
    const legacy = possibleLegacy.filter((row) => row.observation_key === legacyKey(row));
    if (possibleLegacy.length !== legacy.length || legacy.length > 1) throw new Error(`AMBIGUOUS_LEGACY_IDENTITY:${item.observation_key}`);
    if (exact?.lifecycle_state === "current") operations.push({ kind: "unchanged", desired: item, observation: exact });
    else if (exact) operations.push({ kind: "reactivate", desired: item, observation: exact });
    else operations.push({ kind: "insert", desired: item });
    for (const row of candidates) { if (legacy.includes(row)) handledLegacyIds.add(row.id); operations.push({ kind: legacy.includes(row) ? "reconcile_legacy_identity" : "supersede", observation: row, related_key: item.observation_key }); }
  }
  for (const row of existing) if (row.lifecycle_state === "current" && row.metadata_json?.observation_identity_version === IDENTITY_VERSION && !desiredKeys.has(row.observation_key)) operations.push({ kind: "retire_source_absent", observation: row });
  const outOfScopeLegacy = existing.filter((row) => row.lifecycle_state === "current"
    && row.observer_version === REFERENCE_EXTRACTOR_VERSION
    && !row.metadata_json?.observation_identity_version && !handledLegacyIds.has(row.id));
  for (const row of outOfScopeLegacy) {
    const authenticated = row.metadata_json?.fixture_name === "citius-reference-index-pilot"
      && row.created_at != null && row.observation_key === legacyKey(row);
    if (!authenticated) throw new Error(`UNAUTHENTICATED_OUT_OF_SCOPE_V5:${row.id}`);
    operations.push({ kind: "retire_out_of_frozen_scope", observation: row });
  }
  const counts = emptyCounts();
  for (const op of operations) { counts[op.kind]++; if (op.observation?.has_review && op.kind !== "unchanged") counts.retained_reviewed_history++; }
  return { operations, counts };
}

async function loadPlan(client) { const materialized = await materialize(client); const existing = await client.query(EXISTING_SQL,[REFERENCE_EXTRACTOR_KEY]); return { ...materialized, ...planV5Ingestion(materialized.desired, existing.rows) }; }
async function transition(client, row, state, kind, relatedId=null, metadata={}) {
  await client.query("UPDATE casework.reference_observation SET lifecycle_state=$2,updated_at=NOW() WHERE id=$1",[row.id,state]);
  await client.query(`INSERT INTO casework.reference_observation_lifecycle_event(reference_observation_id,related_reference_observation_id,transition_kind,from_state,to_state,actor_key,actor_version,metadata_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[row.id,relatedId,kind,row.lifecycle_state,state,INGESTER_KEY,INGESTER_VERSION,JSON.stringify(metadata)]);
}
async function insert(client,item) {
  const metadata={ observation_identity_version:IDENTITY_VERSION, normalization_identity:NORMALIZATION_IDENTITY, representation_content_sha256:item.representation_content_sha256, segment_content_sha256:item.segment_content_sha256, representation_char_start:item.representation_char_start, representation_char_end:item.representation_char_end, segment_char_start:item.char_start, segment_char_end:item.char_end, extractor_rule_key:item.rule_key, label_provenance:item.label_provenance, reference_family:item.reference_family??null, parsed_candidate:Object.fromEntries(Object.entries(item).filter(([key])=>key.startsWith("parsed_"))), target_resolution:"unresolved", document_identity:"unresolved", binary_identity:"unresolved", fixture_scope:"frozen-v5-expansion-and-foundation" };
  const result=await client.query(`INSERT INTO casework.reference_observation(observation_key,raw_value,normalized_value,raw_label,observed_in_kind,file_binary_id,document_representation_id,document_segment_id,page_no,char_start,char_end,context_text,observer_key,observer_version,namespace_hint,role_hint,target_candidates_json,confidence,review_state,metadata_json,lifecycle_state) VALUES($1,$2,$3,$4,'segment',$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,$14,'[]','high','unreviewed',$15,'current') RETURNING id`,[item.observation_key,item.raw_value,item.normalized_value,item.raw_label,item.file_binary_id,item.document_representation_id,item.document_segment_id,item.page_no,item.char_start,item.char_end,item.context_text,REFERENCE_EXTRACTOR_KEY,REFERENCE_EXTRACTOR_VERSION,item.role_hint,JSON.stringify(metadata)]); return result.rows[0].id;
}

export async function ingestV5Observations(client,{write=false,planLoader=loadPlan,failAfterMutation=false,manageTransaction=true}={}) {
  const output={mode:write?"write":"dry_run",fixture_counts:{positives:111,negatives:50,ambiguous:3},attempted:emptyCounts(),committed:emptyCounts(),mutation_statements_issued:false};
  if(!write){const plan=await planLoader(client);output.attempted=plan.counts;return output;}
  if(manageTransaction)await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try { const plan=await planLoader(client); output.attempted=plan.counts; output.mutation_statements_issued=plan.operations.some((op)=>op.kind!=="unchanged"); const inserted=new Map();const existingCanonical=new Map(plan.operations.filter((op)=>["unchanged","reactivate"].includes(op.kind)).map((op)=>[op.desired.observation_key,op.observation.id]));
    for(const op of plan.operations.filter((x)=>x.kind==="insert")){const id=await insert(client,op.desired);inserted.set(op.desired.observation_key,id);if(failAfterMutation)throw new Error("FORCED_V5_INGESTION_FAILURE");await client.query(`INSERT INTO casework.reference_observation_lifecycle_event(reference_observation_id,transition_kind,from_state,to_state,actor_key,actor_version,metadata_json) VALUES($1,'created',NULL,'current',$2,$3,'{}')`,[id,INGESTER_KEY,INGESTER_VERSION]);}
    for(const op of plan.operations.filter((x)=>["supersede","reconcile_legacy_identity","retire_source_absent","retire_out_of_frozen_scope"].includes(x.kind))){const retiring=["retire_source_absent","retire_out_of_frozen_scope"].includes(op.kind);const state=retiring?"retired_source_absent":"superseded";const relatedId=op.related_key?(inserted.get(op.related_key)??existingCanonical.get(op.related_key)??null):null;const metadata=op.kind==="retire_out_of_frozen_scope"?{corrective_provenance:"authenticated_legacy_pilot_v5_row_created_outside_frozen_scope",fixture_name:op.observation.metadata_json.fixture_name,legacy_created_at:op.observation.created_at}:{};await transition(client,op.observation,state,op.kind,relatedId,metadata);}
    for(const op of plan.operations.filter((x)=>x.kind==="reactivate")){await transition(client,op.observation,"current","reactivated");}
    if(manageTransaction)await client.query("COMMIT");output.committed=plan.counts;return output;
  } catch(error){if(manageTransaction)await client.query("ROLLBACK");error.ingestion_result=output;throw error;}
}

async function main(){const write=process.argv.includes("--write");await withClient("reference-v5-ingestion",async(client)=>console.log(JSON.stringify(await ingestV5Observations(client,{write}),null,2)));}
if(path.resolve(process.argv[1]??"")===fileURLToPath(import.meta.url))main().catch((error)=>{if(error.ingestion_result)console.error(JSON.stringify(error.ingestion_result,null,2));console.error(error);process.exitCode=1;});
