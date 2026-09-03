import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { normalizeReferenceValue } from "./reference-search-store.mjs";
import { withClient } from "./processing-common.mjs";

export const METADATA_INGESTER_KEY = "app/reference-metadata-ingestion.mjs";
export const METADATA_INGESTER_VERSION = "v1";
export const NORMALIZATION_IDENTITY = "reference-normalization-nfkc-upper-v1";

const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

export function buildSourceAssertionKey(item) {
  return sha256([item.observation_origin, item.source_field, item.source_record_id, item.identifier_type].join("\u001f"));
}

export function buildMetadataObservationKey(item) {
  return sha256([
    METADATA_INGESTER_KEY,
    item.source_assertion_key,
    item.raw_value,
    item.normalization_identity,
  ].join("\u001f"));
}

function associationState(available, missing, direct = true) {
  if (!direct) return "no_direct_binary_association";
  if (available > 0 && missing > 0) return "mixed_file_availability";
  if (available > 0) return "all_associated_files_available";
  return "all_associated_files_missing";
}

const SOURCE_ROWS_SQL = `
  SELECT 'court_metadata' AS observation_origin,
         'case_file.processo' AS source_field,
         'process_number' AS identifier_type,
         cf.id::text AS source_record_id, cf.processo AS raw_value,
         cf.id AS case_file_id, NULL::bigint AS bucket_id,
         NULL::bigint AS document_id, NULL::date AS anchored_occurrence_date,
         cf.processo AS process_number,
         '[]'::jsonb AS occurrence_contexts,
         0::int AS available_file_count, 0::int AS missing_file_count
  FROM casework.case_file cf
  WHERE NULLIF(BTRIM(cf.processo), '') IS NOT NULL
  UNION ALL
  SELECT 'court_metadata', 'case_file.idprocesso', 'source_process_id',
         cf.id::text, cf.idprocesso, cf.id, NULL::bigint, NULL::bigint,
         NULL::date, cf.processo, '[]'::jsonb, 0::int, 0::int
  FROM casework.case_file cf
  WHERE NULLIF(BTRIM(cf.idprocesso), '') IS NOT NULL
  UNION ALL
  SELECT 'court_metadata', 'bucket.reference_number', 'occurrence_reference',
         b.id::text, b.reference_number, cf.id, b.id, NULL::bigint,
         b.bucket_date, cf.processo,
         COALESCE(contexts.items, '[]'::jsonb),
         COALESCE(contexts.available_file_count, 0),
         COALESCE(contexts.missing_file_count, 0)
  FROM casework.bucket b
  JOIN casework.case_file cf ON cf.id = b.case_file_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
             'bucket_document_id', bd.id, 'document_id', d.id,
             'document_reference', d.document_procinfo,
             'binary_sha256s', COALESCE(binary_rows.sha256s, '[]'::jsonb)
           ) ORDER BY bd.id) AS items,
           COUNT(*) FILTER (WHERE binary_rows.binary_count > 0)::int AS available_file_count,
           COUNT(*) FILTER (WHERE binary_rows.binary_count = 0)::int AS missing_file_count
    FROM casework.bucket_document bd
    JOIN casework.document d ON d.id = bd.document_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS binary_count,
             COALESCE(jsonb_agg(fb.sha256 ORDER BY fb.sha256), '[]'::jsonb) AS sha256s
      FROM casework.document_binary db
      JOIN casework.file_binary fb ON fb.id = db.file_binary_id
      WHERE db.document_id = d.id
    ) binary_rows ON true
    WHERE bd.bucket_id = b.id
  ) contexts ON true
  WHERE NULLIF(BTRIM(b.reference_number), '') IS NOT NULL
  UNION ALL
  SELECT 'court_metadata', 'document.document_procinfo', 'source_document_reference',
         d.id::text, d.document_procinfo, NULL::bigint, NULL::bigint, d.id,
         NULL::date, NULL::text,
         COALESCE(contexts.items, '[]'::jsonb),
         CASE WHEN binaries.binary_count > 0 THEN 1 ELSE 0 END,
         CASE WHEN binaries.binary_count > 0 THEN 0 ELSE 1 END
  FROM casework.document d
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
             'bucket_document_id', bd.id, 'bucket_id', b.id,
             'occurrence_reference', b.reference_number,
             'occurrence_date', b.bucket_date,
             'process_number', cf.processo
           ) ORDER BY b.bucket_date, b.reference_number, bd.id) AS items
    FROM casework.bucket_document bd
    JOIN casework.bucket b ON b.id = bd.bucket_id
    JOIN casework.case_file cf ON cf.id = b.case_file_id
    WHERE bd.document_id = d.id
  ) contexts ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS binary_count
    FROM casework.document_binary db WHERE db.document_id = d.id
  ) binaries ON true
  WHERE NULLIF(BTRIM(d.document_procinfo), '') IS NOT NULL
  ORDER BY source_field, source_record_id
`;

const EXISTING_SQL = `
  SELECT ro.id, ro.observation_key, ro.raw_value, ro.normalized_value,
         ro.source_assertion_key, ro.normalization_identity,
         ro.lifecycle_state, ro.observer_key, ro.observer_version,
         ro.case_file_id, ro.bucket_id, ro.document_id,
         ro.observation_origin, ro.source_field, ro.identifier_type,
         ro.anchored_occurrence_date, ro.metadata_json,
         EXISTS (SELECT 1 FROM casework.reference_observation_review review
                 WHERE review.reference_observation_id = ro.id) AS has_review
  FROM casework.reference_observation ro
  WHERE ro.observer_key = $1 OR ro.source_assertion_key IS NOT NULL
  ORDER BY ro.id
`;

const LEGACY_PILOT_SQL = `
  SELECT ro.id, ro.observation_key, ro.lifecycle_state, ro.raw_label,
         ro.raw_value, ro.metadata_json, ro.bucket_document_id,
         bd.bucket_id, bd.document_id
  FROM casework.reference_observation ro
  JOIN casework.bucket_document bd ON bd.id = ro.bucket_document_id
  WHERE ro.observer_key = 'virgilio-imported-source-record'
    AND ro.metadata_json ? 'fixture_name'
    AND ro.raw_label IN ('bucket.reference_number', 'document.document_procinfo')
  ORDER BY ro.id
`;

export function materializeDesiredObservation(row) {
  const directAssociation = row.source_field !== "case_file.processo"
    && row.source_field !== "case_file.idprocesso";
  const desired = {
    ...row,
    raw_value: String(row.raw_value),
    normalized_value: normalizeReferenceValue(row.raw_value),
    normalization_identity: NORMALIZATION_IDENTITY,
    binary_association_state: associationState(
      Number(row.available_file_count), Number(row.missing_file_count), directAssociation,
    ),
  };
  desired.source_assertion_key = buildSourceAssertionKey(desired);
  desired.observation_key = buildMetadataObservationKey(desired);
  return desired;
}

function legacyAssertionKey(row) {
  if (row.raw_label === "bucket.reference_number") {
    return buildSourceAssertionKey({
      observation_origin: "court_metadata", source_field: row.raw_label,
      source_record_id: String(row.bucket_id), identifier_type: "occurrence_reference",
    });
  }
  return buildSourceAssertionKey({
    observation_origin: "court_metadata", source_field: row.raw_label,
    source_record_id: String(row.document_id), identifier_type: "source_document_reference",
  });
}

const emptyCounts = () => ({
  insert: 0, unchanged: 0, refresh: 0, reactivate: 0, supersede: 0,
  retire_source_absent: 0, reconcile_legacy_pilot: 0,
  retained_reviewed: 0,
});

function desiredMetadata(item) {
  return {
    source_record_id: item.source_record_id,
    process_number: item.process_number,
    occurrence_contexts: item.occurrence_contexts,
    binary_association_state: item.binary_association_state,
    available_file_count: Number(item.available_file_count),
    missing_file_count: Number(item.missing_file_count),
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function comparableDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isEquivalent(existingItem, desiredItem) {
  return existingItem.observer_version === METADATA_INGESTER_VERSION
    && existingItem.case_file_id === desiredItem.case_file_id
    && existingItem.bucket_id === desiredItem.bucket_id
    && existingItem.document_id === desiredItem.document_id
    && existingItem.observation_origin === desiredItem.observation_origin
    && existingItem.source_field === desiredItem.source_field
    && existingItem.identifier_type === desiredItem.identifier_type
    && comparableDate(existingItem.anchored_occurrence_date) === comparableDate(desiredItem.anchored_occurrence_date)
    && stableJson(existingItem.metadata_json) === stableJson(desiredMetadata(desiredItem));
}

export function planMetadataReferenceIngestion(sourceRows, existingRows, legacyPilotRows) {
  const desired = sourceRows.map(materializeDesiredObservation);
  const existingByKey = new Map(existingRows.map((item) => [item.observation_key, item]));
  const existingByAssertion = new Map();
  for (const item of existingRows.filter((row) => row.source_assertion_key)) {
    const rows = existingByAssertion.get(item.source_assertion_key) ?? [];
    rows.push(item);
    existingByAssertion.set(item.source_assertion_key, rows);
  }
  const operations = [];
  const desiredAssertionKeys = new Set(desired.map((item) => item.source_assertion_key));
  for (const item of desired) {
    const exact = existingByKey.get(item.observation_key);
    const current = (existingByAssertion.get(item.source_assertion_key) ?? [])
      .find((candidate) => candidate.lifecycle_state === "current");
    if (exact?.lifecycle_state === "current") {
      operations.push({ kind: isEquivalent(exact, item) ? "unchanged" : "refresh", desired: item, observation: exact });
    } else if (exact) {
      if (current && current.id !== exact.id) operations.push({ kind: "supersede", observation: current, related: exact });
      operations.push({ kind: "reactivate", desired: item, observation: exact, related: current ?? null });
    } else {
      operations.push({ kind: "insert", desired: item, related: current ?? null });
      if (current) operations.push({ kind: "supersede", observation: current, related_key: item.observation_key });
    }
  }
  for (const item of existingRows.filter((row) => (
    row.observer_key === METADATA_INGESTER_KEY
      && row.lifecycle_state === "current"
      && !desiredAssertionKeys.has(row.source_assertion_key)
  ))) {
    operations.push({ kind: "retire_source_absent", observation: item });
  }
  const desiredByAssertion = new Map(desired.map((item) => [item.source_assertion_key, item]));
  for (const legacy of legacyPilotRows) {
    const replacement = desiredByAssertion.get(legacyAssertionKey(legacy));
    if (replacement && legacy.lifecycle_state === "current") {
      operations.push({ kind: "reconcile_legacy_pilot", observation: legacy, related_key: replacement.observation_key });
    }
  }
  const counts = emptyCounts();
  for (const operation of operations) {
    counts[operation.kind] += 1;
    if (operation.observation?.has_review) counts.retained_reviewed += 1;
  }
  return { desired, operations, counts };
}

async function loadPlan(client) {
  const source = await client.query(SOURCE_ROWS_SQL);
  const existing = await client.query(EXISTING_SQL, [METADATA_INGESTER_KEY]);
  const legacy = await client.query(LEGACY_PILOT_SQL);
  return planMetadataReferenceIngestion(source.rows, existing.rows, legacy.rows);
}

async function recordTransition(client, observationId, relatedId, kind, fromState, toState, metadata = {}) {
  await client.query(`
    INSERT INTO casework.reference_observation_lifecycle_event (
      reference_observation_id, related_reference_observation_id,
      transition_kind, from_state, to_state, actor_key, actor_version,
      metadata_json
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
  `, [observationId, relatedId, kind, fromState, toState,
    METADATA_INGESTER_KEY, METADATA_INGESTER_VERSION, JSON.stringify(metadata)]);
}

async function resolveObservationId(client, observationKey) {
  const result = await client.query(
    "SELECT id FROM casework.reference_observation WHERE observation_key = $1",
    [observationKey],
  );
  return result.rows[0]?.id ?? null;
}

async function insertDesired(client, item) {
  const result = await client.query(`
    INSERT INTO casework.reference_observation (
      observation_key, raw_value, normalized_value, raw_label,
      observed_in_kind, case_file_id, bucket_id, document_id,
      observer_key, observer_version, namespace_hint, role_hint,
      target_candidates_json, confidence, review_state, metadata_json,
      observation_origin, source_field, identifier_type,
      source_assertion_key, normalization_identity,
      anchored_occurrence_date, lifecycle_state
    ) VALUES (
      $1,$2,$3,$4,'source_record',$5,$6,$7,$8,$9,$10,$11,
      '[]'::jsonb,'high','unreviewed',$12::jsonb,$13,$14,$15,$16,$17,$18,'current'
    ) RETURNING id
  `, [
    item.observation_key, item.raw_value, item.normalized_value, item.source_field,
    item.case_file_id, item.bucket_id, item.document_id,
    METADATA_INGESTER_KEY, METADATA_INGESTER_VERSION,
    item.identifier_type, "source_recorded_identifier", JSON.stringify({
      source_record_id: item.source_record_id,
      process_number: item.process_number,
      occurrence_contexts: item.occurrence_contexts,
      binary_association_state: item.binary_association_state,
      available_file_count: Number(item.available_file_count),
      missing_file_count: Number(item.missing_file_count),
    }), item.observation_origin, item.source_field, item.identifier_type,
    item.source_assertion_key, item.normalization_identity,
    item.anchored_occurrence_date,
  ]);
  return result.rows[0].id;
}

async function refreshDesired(client, observationId, item) {
  await client.query(`
    UPDATE casework.reference_observation SET
      observer_version = $2, anchored_occurrence_date = $3,
      metadata_json = $4::jsonb, updated_at = NOW()
    WHERE id = $1
  `, [observationId, METADATA_INGESTER_VERSION, item.anchored_occurrence_date,
    JSON.stringify(desiredMetadata(item))]);
}

async function setLifecycle(client, operation, state, relatedId = null) {
  await client.query(
    "UPDATE casework.reference_observation SET lifecycle_state = $2, updated_at = NOW() WHERE id = $1",
    [operation.observation.id, state],
  );
  await recordTransition(
    client, operation.observation.id, relatedId, operation.kind,
    operation.observation.lifecycle_state, state,
    operation.related_key ? { related_observation_key: operation.related_key } : {},
  );
}

export async function ingestMetadataReferences(client, { write = false } = {}) {
  const plan = await loadPlan(client);
  const result = {
    mode: write ? "write" : "dry_run",
    attempted: plan.counts,
    committed: emptyCounts(),
    desired_observation_count: plan.desired.length,
    mutation_statements_issued: false,
  };
  if (!write) return result;

  await client.query("BEGIN");
  result.mutation_statements_issued = true;
  try {
    const insertedIds = new Map();
    for (const operation of plan.operations.filter((item) => item.kind === "supersede")) {
      await setLifecycle(client, operation, "superseded", operation.related?.id ?? null);
    }
    for (const operation of plan.operations.filter((item) => item.kind === "insert")) {
      const id = await insertDesired(client, operation.desired);
      insertedIds.set(operation.desired.observation_key, id);
      await recordTransition(client, id, operation.related?.id ?? null, "created", null, "current");
    }
    for (const operation of plan.operations.filter((item) => !["insert", "supersede", "unchanged"].includes(item.kind))) {
      if (operation.kind === "refresh") await refreshDesired(client, operation.observation.id, operation.desired);
      else if (operation.kind === "reactivate") {
        await refreshDesired(client, operation.observation.id, operation.desired);
        await setLifecycle(client, operation, "current", operation.related?.id ?? null);
      }
      else if (operation.kind === "retire_source_absent") await setLifecycle(client, operation, "retired_source_absent");
      else if (operation.kind === "reconcile_legacy_pilot") {
        const relatedId = insertedIds.get(operation.related_key)
          ?? await resolveObservationId(client, operation.related_key);
        await setLifecycle(client, operation, "superseded", relatedId);
      }
    }
    await client.query("COMMIT");
    result.committed = { ...plan.counts };
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    error.ingestion_result = result;
    throw error;
  }
}

async function main() {
  const write = process.argv.includes("--write");
  await withClient("reference-metadata-ingestion", async (client) => {
    console.log(JSON.stringify(await ingestMetadataReferences(client, { write }), null, 2));
  });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    if (error.ingestion_result) console.error(JSON.stringify(error.ingestion_result, null, 2));
    console.error(error);
    process.exitCode = 1;
  });
}
