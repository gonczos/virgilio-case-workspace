import { normalizeReferenceValue } from "./reference-search-store.mjs";

export const REFERENCE_PILOT_FIXTURE = "citius-reference-index-pilot";
export const REFERENCE_LOOKUP_DEFAULT_LIMIT = 50;
export const REFERENCE_LOOKUP_MAX_LIMIT = 100;
export const REFERENCE_LOOKUP_MAX_OFFSET = 1_000_000;

const LOOKUP_SQL = `
  WITH fixture_assertion AS (
    SELECT DISTINCT replacement.source_assertion_key
    FROM casework.reference_observation fixture
    JOIN casework.reference_observation_lifecycle_event event
      ON event.reference_observation_id = fixture.id
    JOIN casework.reference_observation replacement
      ON replacement.id = event.related_reference_observation_id
    WHERE fixture.metadata_json->>'fixture_name' = $5
      AND replacement.source_assertion_key IS NOT NULL
  ), eligible AS (
    SELECT ro.*,
           COALESCE(ro.observation_origin,
             CASE
               WHEN ro.observer_key = 'document-register-csv' THEN 'external_register'
               WHEN ro.observed_in_kind IN ('representation', 'segment') THEN 'document_text'
               ELSE 'court_metadata'
             END) AS effective_origin
    FROM casework.reference_observation ro
    WHERE ro.normalized_value = $1
      AND ($2 = 'include_history' OR ro.lifecycle_state = 'current')
      AND ($3 = 'full'
        OR ro.metadata_json->>'fixture_name' = $5
        OR (ro.source_assertion_key IS NOT NULL AND EXISTS (
          SELECT 1 FROM fixture_assertion fixture_key
          WHERE fixture_key.source_assertion_key = ro.source_assertion_key
        )))
  )
  SELECT eligible.*,
         review.namespace_hint AS reviewed_namespace_hint,
         review.role_hint AS reviewed_role_hint,
         review.target_candidates_json AS reviewed_target_candidates_json,
         review.resolution_state AS reviewed_resolution_state,
         review.confidence AS reviewed_confidence,
         review.review_state AS reviewed_review_state,
         review.review_note, review.reviewer_key,
         review.metadata_json AS review_metadata_json,
         review.created_at AS review_created_at,
         review.updated_at AS review_updated_at,
         cf.processo AS direct_process_number,
         b.reference_number AS direct_occurrence_reference,
         to_char(b.bucket_date, 'YYYY-MM-DD') AS direct_occurrence_date,
         d.document_procinfo AS direct_document_reference,
         dr.processor_key AS direct_processor_key,
         dr.processor_version AS direct_processor_version,
         current_row.observation_key AS current_observation_key
  FROM eligible
  LEFT JOIN casework.reference_observation_review review
    ON review.reference_observation_id = eligible.id
  LEFT JOIN casework.case_file cf ON cf.id = eligible.case_file_id
  LEFT JOIN casework.bucket b ON b.id = eligible.bucket_id
  LEFT JOIN casework.document d ON d.id = eligible.document_id
  LEFT JOIN casework.document_representation dr
    ON dr.id = eligible.document_representation_id
  LEFT JOIN casework.reference_observation current_row
    ON current_row.source_assertion_key = eligible.source_assertion_key
   AND current_row.lifecycle_state = 'current'
  ORDER BY
    CASE eligible.effective_origin
      WHEN 'court_metadata' THEN 1
      WHEN 'external_register' THEN 2
      WHEN 'document_text' THEN 3
      ELSE 4
    END,
    eligible.anchored_occurrence_date ASC NULLS LAST,
    eligible.observation_key ASC
  LIMIT $4 OFFSET $6
`;

const CONTEXT_SQL = `
  WITH selected AS (
    SELECT * FROM casework.reference_observation WHERE id = ANY($1::bigint[])
  ), anchor_document AS (
    SELECT selected.id AS observation_id, selected.document_id
    FROM selected WHERE selected.document_id IS NOT NULL
    UNION
    SELECT selected.id, bd.document_id
    FROM selected JOIN casework.bucket_document bd ON bd.id = selected.bucket_document_id
    UNION
    SELECT selected.id, bd.document_id
    FROM selected JOIN casework.bucket_document bd ON bd.bucket_id = selected.bucket_id
    UNION
    SELECT selected.id, db.document_id
    FROM selected JOIN casework.document_binary db ON db.file_binary_id = selected.file_binary_id
    UNION
    SELECT selected.id, db.document_id
    FROM selected
    JOIN casework.document_representation dr ON dr.id = selected.document_representation_id
    JOIN casework.document_binary db ON db.file_binary_id = dr.file_binary_id
    UNION
    SELECT selected.id, db.document_id
    FROM selected
    JOIN casework.document_segment ds ON ds.id = selected.document_segment_id
    JOIN casework.document_representation dr ON dr.id = ds.document_representation_id
    JOIN casework.document_binary db ON db.file_binary_id = dr.file_binary_id
  )
  SELECT anchor_document.observation_id, d.id AS document_id,
         bd.id AS bucket_document_id, cf.id AS case_file_id, b.id AS bucket_id,
         cf.processo AS process_number, b.reference_number AS occurrence_reference,
         to_char(b.bucket_date, 'YYYY-MM-DD') AS occurrence_date,
         d.document_procinfo AS document_reference,
         COALESCE(binary_rows.binaries, '[]'::jsonb) AS binaries
  FROM anchor_document
  JOIN casework.document d ON d.id = anchor_document.document_id
  LEFT JOIN casework.bucket_document bd ON bd.document_id = d.id
  LEFT JOIN casework.bucket b ON b.id = bd.bucket_id
  LEFT JOIN casework.case_file cf ON cf.id = b.case_file_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'file_binary_id', fb.id, 'sha256', fb.sha256
    ) ORDER BY fb.sha256) AS binaries
    FROM casework.document_binary db
    JOIN casework.file_binary fb ON fb.id = db.file_binary_id
    WHERE db.document_id = d.id
  ) binary_rows ON true
  ORDER BY anchor_document.observation_id, b.bucket_date NULLS LAST,
           b.reference_number, d.id, bd.id
`;

const EVENT_SQL = `
  SELECT event.reference_observation_id, event.transition_kind,
         event.from_state, event.to_state, event.occurred_at,
         related.observation_key AS related_observation_key
  FROM casework.reference_observation_lifecycle_event event
  LEFT JOIN casework.reference_observation related
    ON related.id = event.related_reference_observation_id
  WHERE event.reference_observation_id = ANY($1::bigint[])
  ORDER BY event.reference_observation_id, event.occurred_at, event.id
`;

function directAnchor(row, origin) {
  let kind;
  if (origin === "external_register") kind = "external_source_record";
  else if (row.observed_in_kind === "representation" || row.observed_in_kind === "segment") kind = "document_text";
  else if (row.bucket_id != null) kind = "occurrence";
  else if (row.case_file_id != null) kind = "case_file";
  else kind = "document";
  return {
    kind,
    case_file_id: numericId(row.case_file_id),
    bucket_id: numericId(row.bucket_id),
    document_id: numericId(row.document_id),
    bucket_document_id: numericId(row.bucket_document_id),
    file_binary_id: numericId(row.file_binary_id),
    document_representation_id: numericId(row.document_representation_id),
    document_segment_id: numericId(row.document_segment_id),
    page_no: row.page_no == null ? null : Number(row.page_no),
    char_start: row.char_start == null ? null : Number(row.char_start),
    char_end: row.char_end == null ? null : Number(row.char_end),
    process_number: row.direct_process_number ?? null,
    occurrence_reference: row.direct_occurrence_reference ?? null,
    occurrence_date: row.direct_occurrence_date ?? null,
    document_reference: row.direct_document_reference ?? null,
    processor_key: row.direct_processor_key ?? null,
    processor_version: row.direct_processor_version ?? null,
    external_source_name: origin === "external_register" ? row.observer_key : null,
    external_source_record_id: origin === "external_register"
      ? row.metadata_json?.source_record_id ?? null : null,
  };
}

function numericId(value) {
  return value == null ? null : Number(value);
}

function mapContexts(rows) {
  return rows.map((row) => {
    const binaries = row.binaries ?? [];
    return {
      document_id: numericId(row.document_id),
      bucket_document_id: numericId(row.bucket_document_id),
      case_file_id: numericId(row.case_file_id),
      bucket_id: numericId(row.bucket_id),
      process_number: row.process_number ?? null,
      occurrence_reference: row.occurrence_reference ?? null,
      occurrence_date: row.occurrence_date ?? null,
      document_reference: row.document_reference ?? null,
      file_availability: binaries.length > 0 ? "available" : "missing",
      binary_sha256s: binaries.map((item) => item.sha256),
    };
  });
}

function mapBinaries(rows) {
  const binaries = new Map();
  for (const row of rows) {
    for (const binary of row.binaries ?? []) {
      const item = binaries.get(binary.sha256) ?? {
        file_binary_id: numericId(binary.file_binary_id),
        sha256: binary.sha256,
        availability: "available",
        open_action: { href: `/api/consultation/binaries/${binary.sha256}` },
        contexts: [],
      };
      const context = {
        document_id: numericId(row.document_id),
        bucket_document_id: numericId(row.bucket_document_id),
        case_file_id: numericId(row.case_file_id),
        bucket_id: numericId(row.bucket_id),
      };
      if (!item.contexts.some((candidate) => JSON.stringify(candidate) === JSON.stringify(context))) {
        item.contexts.push(context);
      }
      binaries.set(binary.sha256, item);
    }
  }
  return [...binaries.values()].sort((a, b) => a.sha256.localeCompare(b.sha256));
}

function associationState(row, contexts, binaries) {
  if (row.metadata_json?.binary_association_state) return row.metadata_json.binary_association_state;
  if (row.case_file_id != null && contexts.length === 0) return "no_direct_binary_association";
  const hasMissing = contexts.some((item) => item.file_availability === "missing");
  if (binaries.length > 0 && hasMissing) return "mixed_file_availability";
  if (binaries.length > 0) return "all_associated_files_available";
  return contexts.length > 0 ? "all_associated_files_missing" : "no_direct_binary_association";
}

function humanReview(row) {
  if (!row.reviewer_key) return null;
  return {
    namespace_hint: row.reviewed_namespace_hint ?? null,
    role_hint: row.reviewed_role_hint ?? null,
    target_candidates: row.reviewed_target_candidates_json ?? [],
    resolution_state: row.reviewed_resolution_state,
    confidence: row.reviewed_confidence ?? null,
    review_state: row.reviewed_review_state,
    review_note: row.review_note ?? null,
    reviewer_key: row.reviewer_key,
    metadata: row.review_metadata_json ?? {},
    created_at: row.review_created_at,
    updated_at: row.review_updated_at,
  };
}

export function buildRecordedReferenceObservation(row, contextRows = [], eventRows = []) {
  const origin = row.effective_origin;
  const associatedContexts = mapContexts(contextRows);
  const associatedBinaries = mapBinaries(contextRows);
  const currentKey = row.lifecycle_state === "current"
    ? row.observation_key
    : row.current_observation_key
      ?? [...eventRows].reverse().find((event) => event.related_observation_key)?.related_observation_key
      ?? null;
  return {
    observation_id: Number(row.id),
    observation_key: row.observation_key,
    reference: {
      raw_value: row.raw_value,
      normalized_value: row.normalized_value,
      raw_label: row.raw_label ?? null,
      identifier_type: row.identifier_type ?? null,
    },
    origin,
    lifecycle: {
      state: row.lifecycle_state,
      current_observation_key: currentKey,
      events: eventRows.map((event) => ({
        transition_kind: event.transition_kind,
        from_state: event.from_state ?? null,
        to_state: event.to_state,
        occurred_at: event.occurred_at,
        related_observation_key: event.related_observation_key ?? null,
      })),
    },
    direct_anchor: directAnchor(row, origin),
    associated_contexts: associatedContexts,
    binary_association_state: associationState(row, associatedContexts, associatedBinaries),
    associated_binaries: associatedBinaries,
    provenance: {
      observed_in_kind: row.observed_in_kind,
      source_field: row.source_field ?? row.raw_label ?? null,
      observer_key: row.observer_key,
      observer_version: row.observer_version,
      normalization_identity: row.normalization_identity ?? null,
    },
    ingestion_assessment: {
      namespace_hint: row.namespace_hint ?? null,
      role_hint: row.role_hint ?? null,
      target_candidates: row.target_candidates_json ?? [],
      confidence: row.confidence ?? null,
      review_state: row.review_state,
    },
    human_review: humanReview(row),
  };
}

function coverage(scope, lifecycle) {
  if (scope === "pilot") {
    return {
      corpus_scope: scope,
      lifecycle_scope: lifecycle,
      status: "complete_for_declared_sources",
      included_origins: ["court_metadata", "external_register", "document_text"],
      limitations: [],
    };
  }
  return {
    corpus_scope: scope,
    lifecycle_scope: lifecycle,
    status: "incomplete",
    included_origins: ["court_metadata", "external_register", "document_text"],
    limitations: [{
      code: "NON_COURT_METADATA_COVERAGE_IS_PILOT_ONLY",
      message: "External-register and document-text observations remain pilot-scoped.",
    }],
  };
}

export async function lookupRecordedReferences(client, value, {
  scope = "full",
  lifecycle = "current",
  limit = REFERENCE_LOOKUP_DEFAULT_LIMIT,
  offset = 0,
} = {}) {
  const normalizedValue = normalizeReferenceValue(value);
  const probed = await client.query(LOOKUP_SQL, [
    normalizedValue, lifecycle, scope, limit + 1, REFERENCE_PILOT_FIXTURE, offset,
  ]);
  const rows = probed.rows.slice(0, limit);
  const ids = rows.map((row) => row.id);
  const contexts = ids.length ? await client.query(CONTEXT_SQL, [ids]) : { rows: [] };
  const events = lifecycle === "include_history" && ids.length
    ? await client.query(EVENT_SQL, [ids]) : { rows: [] };
  const byObservation = (items) => {
    const grouped = new Map();
    for (const item of items) {
      const key = String(item.observation_id ?? item.reference_observation_id);
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return grouped;
  };
  const contextMap = byObservation(contexts.rows);
  const eventMap = byObservation(events.rows);
  const observations = rows.map((row) => buildRecordedReferenceObservation(
    row, contextMap.get(String(row.id)) ?? [], eventMap.get(String(row.id)) ?? [],
  ));
  const hasMore = probed.rows.length > limit;
  const coverageInfo = coverage(scope, lifecycle);
  const resultState = observations.length > 0
    ? "matches"
    : coverageInfo.status === "complete_for_declared_sources"
      ? "no_matches_within_coverage"
      : "coverage_unavailable_or_incomplete";
  return {
    query: { raw_value: String(value), normalized_value: normalizedValue, scope, lifecycle },
    result_state: resultState,
    coverage: coverageInfo,
    pagination: {
      unit: "observations", limit, offset, returned: observations.length,
      has_more: hasMore, next_offset: hasMore ? offset + observations.length : null,
    },
    observations,
  };
}
