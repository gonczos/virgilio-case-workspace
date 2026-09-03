import crypto from "node:crypto";

export const REFERENCE_EXTRACTOR_KEY = "app/reference-search-store.mjs";
export const REFERENCE_EXTRACTOR_VERSION = "labelled-reference-v3";

export function normalizeReferenceValue(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ").toUpperCase();
}

function compactContext(text, start, end, radius = 90) {
  return text.slice(Math.max(0, start - radius), Math.min(text.length, end + radius))
    .replace(/\s+/gu, " ")
    .trim();
}

export function extractLabelledReferences(text) {
  const source = String(text ?? "");
  const patterns = [
    { role: "cited_reference", regex: /\b(SOB\s+A\s+REF[.ªº]*|COM\s+A\s+REF[.ªº]*|REFER[ÊE]NCIA\s+CITIUS\s*(?:N[.º°O]+)?)(?:\s*[:.]\s*|\s+)([A-Z0-9][A-Z0-9./_-]{4,})/giu },
    { role: "labelled_reference", regex: /\b(REF(?:ER[ÊE]NCIA)?\s*(?:N[.º°O]+)?|REF[.ªº]*)(?:\s*[:.]\s*|\s+)([A-Z0-9][A-Z0-9./_-]{4,})/giu },
  ];
  const observations = [];
  const seen = new Set();
  for (const { role, regex } of patterns) {
    for (const match of source.matchAll(regex)) {
      const rawLabel = match[1].trim();
      const rawValue = match[2].replace(/[.,;:)]+$/gu, "");
      if (/^REFER/iu.test(rawLabel) && /^CITIUS$/iu.test(rawValue)) continue;
      const normalizedValue = normalizeReferenceValue(rawValue);
      const charStart = match.index + match[0].lastIndexOf(match[2]);
      const charEnd = charStart + rawValue.length;
      const key = `${charStart}:${charEnd}:${normalizedValue}`;
      if (seen.has(key)) continue;
      seen.add(key);
      observations.push({
        raw_value: rawValue,
        normalized_value: normalizedValue,
        raw_label: rawLabel,
        role_hint: role,
        char_start: charStart,
        char_end: charEnd,
        context_text: compactContext(source, charStart, charEnd),
      });
    }
  }
  return observations.sort((a, b) => a.char_start - b.char_start || a.normalized_value.localeCompare(b.normalized_value));
}

export function buildObservationKey(observation) {
  const identity = [
    observation.observer_key,
    observation.observer_version,
    observation.observed_in_kind,
    observation.bucket_document_id ?? "",
    observation.document_id ?? "",
    observation.file_binary_id ?? "",
    observation.document_representation_id ?? "",
    observation.document_segment_id ?? "",
    observation.page_no ?? "",
    observation.char_start ?? "",
    observation.char_end ?? "",
    observation.raw_label ?? "",
    normalizeReferenceValue(observation.raw_value),
  ].join("\u001f");
  return crypto.createHash("sha256").update(identity, "utf8").digest("hex");
}

export async function upsertReferenceObservation(client, observation) {
  const normalizedValue = normalizeReferenceValue(observation.raw_value);
  if (!normalizedValue) throw new Error("Reference observation value must not be blank");
  const row = { ...observation, normalized_value: normalizedValue };
  row.observation_key ??= buildObservationKey(row);
  const result = await client.query(`
    INSERT INTO casework.reference_observation (
      observation_key, raw_value, normalized_value, raw_label, observed_in_kind,
      bucket_document_id, document_id, file_binary_id, document_representation_id,
      document_segment_id, page_no, char_start, char_end, context_text,
      observer_key, observer_version, namespace_hint, role_hint,
      target_candidates_json, confidence, review_state, metadata_json
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
      $19::jsonb,$20,$21,$22::jsonb
    )
    ON CONFLICT (observation_key) DO UPDATE SET
      raw_value = EXCLUDED.raw_value,
      normalized_value = EXCLUDED.normalized_value,
      raw_label = EXCLUDED.raw_label,
      context_text = EXCLUDED.context_text,
      namespace_hint = EXCLUDED.namespace_hint,
      role_hint = EXCLUDED.role_hint,
      target_candidates_json = EXCLUDED.target_candidates_json,
      confidence = EXCLUDED.confidence,
      review_state = EXCLUDED.review_state,
      metadata_json = EXCLUDED.metadata_json,
      updated_at = NOW()
    RETURNING *
  `, [
    row.observation_key, row.raw_value, normalizedValue, row.raw_label ?? null,
    row.observed_in_kind, row.bucket_document_id ?? null, row.document_id ?? null,
    row.file_binary_id ?? null, row.document_representation_id ?? null,
    row.document_segment_id ?? null, row.page_no ?? null, row.char_start ?? null,
    row.char_end ?? null, row.context_text ?? null, row.observer_key,
    row.observer_version, row.namespace_hint ?? null, row.role_hint ?? null,
    JSON.stringify(row.target_candidates ?? []), row.confidence ?? null,
    row.review_state ?? "unreviewed", JSON.stringify(row.metadata ?? {}),
  ]);
  return result.rows[0];
}

export async function upsertReferenceReview(client, review) {
  const result = await client.query(`
    INSERT INTO casework.reference_observation_review (
      reference_observation_id, namespace_hint, role_hint,
      target_candidates_json, resolution_state, confidence, review_state,
      review_note, reviewer_key, metadata_json
    ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb)
    ON CONFLICT (reference_observation_id) DO UPDATE SET
      namespace_hint = EXCLUDED.namespace_hint,
      role_hint = EXCLUDED.role_hint,
      target_candidates_json = EXCLUDED.target_candidates_json,
      resolution_state = EXCLUDED.resolution_state,
      confidence = EXCLUDED.confidence,
      review_state = EXCLUDED.review_state,
      review_note = EXCLUDED.review_note,
      reviewer_key = EXCLUDED.reviewer_key,
      metadata_json = EXCLUDED.metadata_json,
      updated_at = NOW()
    RETURNING *
  `, [
    review.reference_observation_id, review.namespace_hint ?? null,
    review.role_hint ?? null, JSON.stringify(review.target_candidates ?? []),
    review.resolution_state ?? "unresolved", review.confidence ?? null,
    review.review_state, review.review_note ?? null, review.reviewer_key,
    JSON.stringify(review.metadata ?? {}),
  ]);
  return result.rows[0];
}

export async function lookupReference(client, value, { fixtureName = null } = {}) {
  const result = await client.query(`
    SELECT ro.*, fb.sha256, d.document_procinfo,
           source_dr.processor_key AS source_processor_key,
           source_dr.processor_version AS source_processor_version,
           b.reference_number AS occurrence_reference,
           cf.processo AS process_number,
           CASE WHEN review.reference_observation_id IS NULL THEN NULL
             ELSE jsonb_build_object(
               'namespace_hint', review.namespace_hint,
               'role_hint', review.role_hint,
               'target_candidates', review.target_candidates_json,
               'resolution_state', review.resolution_state,
               'confidence', review.confidence,
               'review_state', review.review_state,
               'review_note', review.review_note,
               'reviewer_key', review.reviewer_key,
               'metadata', review.metadata_json,
               'created_at', review.created_at,
               'updated_at', review.updated_at
             ) END AS review,
           COALESCE(ctx.contexts, '[]'::jsonb) AS source_contexts
    FROM casework.reference_observation ro
    LEFT JOIN casework.reference_observation_review review
      ON review.reference_observation_id = ro.id
    LEFT JOIN casework.file_binary fb ON fb.id = ro.file_binary_id
    LEFT JOIN casework.document_representation source_dr
      ON source_dr.id = ro.document_representation_id
    LEFT JOIN casework.document d ON d.id = ro.document_id
    LEFT JOIN casework.bucket_document bd ON bd.id = ro.bucket_document_id
    LEFT JOIN casework.bucket b ON b.id = bd.bucket_id
    LEFT JOIN casework.case_file cf ON cf.id = b.case_file_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'bucket_document_id', context_row.bucket_document_id,
        'document_id', context_row.document_id,
        'process_number', context_row.process_number,
        'occurrence_reference', context_row.occurrence_reference,
        'occurrence_date', context_row.occurrence_date,
        'designation', context_row.designation,
        'document_reference', context_row.document_reference
      ) ORDER BY context_row.occurrence_date, context_row.occurrence_reference,
        context_row.document_id) AS contexts
      FROM (
        SELECT bd_direct.id AS bucket_document_id, d_direct.id AS document_id,
               cf_direct.processo AS process_number,
               b_direct.reference_number AS occurrence_reference,
               b_direct.bucket_date AS occurrence_date,
               b_direct.designation, d_direct.document_procinfo AS document_reference
        FROM casework.bucket_document bd_direct
        JOIN casework.document d_direct ON d_direct.id = bd_direct.document_id
        JOIN casework.bucket b_direct ON b_direct.id = bd_direct.bucket_id
        JOIN casework.case_file cf_direct ON cf_direct.id = b_direct.case_file_id
        WHERE bd_direct.id = ro.bucket_document_id
        UNION
        SELECT bd2.id, d2.id, cf2.processo, b2.reference_number,
               b2.bucket_date, b2.designation, d2.document_procinfo
        FROM casework.document_binary db2
        JOIN casework.document d2 ON d2.id = db2.document_id
        JOIN casework.bucket_document bd2 ON bd2.document_id = d2.id
        JOIN casework.bucket b2 ON b2.id = bd2.bucket_id
        JOIN casework.case_file cf2 ON cf2.id = b2.case_file_id
        WHERE db2.file_binary_id = ro.file_binary_id
      ) context_row
    ) ctx ON true
    WHERE ro.normalized_value = $1
      AND ($2::text IS NULL OR ro.metadata_json->>'fixture_name' = $2)
    ORDER BY ro.observed_in_kind, ro.id
  `, [normalizeReferenceValue(value), fixtureName]);
  return result.rows;
}

export async function searchPassages(client, query, { limit = 20, sha256s = null } = {}) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const result = await client.query(`
    SELECT ds.id AS segment_id, ds.document_representation_id,
           dr.file_binary_id, fb.sha256, dr.representation_kind,
           dr.processor_key, dr.processor_version, ds.segment_kind,
           ds.sequence_no, ds.page_no, ds.char_start, ds.char_end,
           CASE
             WHEN ds.page_no IS NULL THEN 'document_level'
             WHEN ds.metadata_json->>'pdf_page_verified' = 'true'
               THEN 'verified_pdf_page'
             ELSE 'processor_page_unverified'
           END AS location_kind,
           ts_rank_cd(ds.search_vector, websearch_to_tsquery('portuguese', $1)) AS rank,
           ts_headline('portuguese', ds.text_content,
             websearch_to_tsquery('portuguese', $1),
             'MaxWords=35, MinWords=12, StartSel=[[, StopSel=]]') AS headline,
           COALESCE(ctx.contexts, '[]'::jsonb) AS source_contexts,
           COALESCE(passage_refs.references, '[]'::jsonb) AS passage_reference_observations,
           COALESCE(context_refs.references, '[]'::jsonb) AS contextual_reference_observations
    FROM casework.document_segment ds
    JOIN casework.document_representation dr ON dr.id = ds.document_representation_id
    JOIN casework.file_binary fb ON fb.id = dr.file_binary_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'bucket_document_id', bd.id, 'document_id', d.id,
        'process_number', cf.processo, 'occurrence_reference', b.reference_number,
        'occurrence_date', b.bucket_date, 'designation', b.designation,
        'document_reference', d.document_procinfo, 'document_name', d.document_name
      ) ORDER BY b.bucket_date, b.reference_number, d.id) AS contexts
      FROM casework.document_binary db
      JOIN casework.document d ON d.id = db.document_id
      JOIN casework.bucket_document bd ON bd.document_id = d.id
      JOIN casework.bucket b ON b.id = bd.bucket_id
      JOIN casework.case_file cf ON cf.id = b.case_file_id
      WHERE db.file_binary_id = dr.file_binary_id
    ) ctx ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ro.id, 'observation_key', ro.observation_key,
        'raw_value', ro.raw_value, 'normalized_value', ro.normalized_value,
        'raw_label', ro.raw_label,
        'observed_in_kind', ro.observed_in_kind, 'role_hint', ro.role_hint,
        'namespace_hint', ro.namespace_hint, 'page_no', ro.page_no,
        'target_candidates', ro.target_candidates_json,
        'char_start', ro.char_start, 'char_end', ro.char_end,
        'context_text', ro.context_text,
        'metadata', ro.metadata_json,
        'bucket_document_id', ro.bucket_document_id,
        'document_id', ro.document_id, 'file_binary_id', ro.file_binary_id,
        'document_representation_id', ro.document_representation_id,
        'document_segment_id', ro.document_segment_id,
        'observer_key', ro.observer_key, 'observer_version', ro.observer_version,
        'source_processor_key', source_dr.processor_key,
        'source_processor_version', source_dr.processor_version,
        'source_occurrence_reference', source_bucket.reference_number,
        'source_process_number', source_case.processo,
        'confidence', ro.confidence, 'review_state', ro.review_state,
        'review', CASE WHEN review.reference_observation_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'namespace_hint', review.namespace_hint, 'role_hint', review.role_hint,
            'target_candidates', review.target_candidates_json,
            'resolution_state', review.resolution_state,
            'confidence', review.confidence, 'review_state', review.review_state,
            'review_note', review.review_note, 'reviewer_key', review.reviewer_key,
            'metadata', review.metadata_json,
            'created_at', review.created_at, 'updated_at', review.updated_at
          ) END
      ) ORDER BY ro.id) AS references
      FROM casework.reference_observation ro
      LEFT JOIN casework.document_representation source_dr
        ON source_dr.id = ro.document_representation_id
      LEFT JOIN casework.bucket_document source_bd ON source_bd.id = ro.bucket_document_id
      LEFT JOIN casework.bucket source_bucket ON source_bucket.id = source_bd.bucket_id
      LEFT JOIN casework.case_file source_case ON source_case.id = source_bucket.case_file_id
      LEFT JOIN casework.reference_observation_review review
        ON review.reference_observation_id = ro.id
      WHERE ro.document_segment_id = ds.id
    ) passage_refs ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ro.id, 'observation_key', ro.observation_key,
        'raw_value', ro.raw_value, 'normalized_value', ro.normalized_value,
        'raw_label', ro.raw_label,
        'observed_in_kind', ro.observed_in_kind, 'role_hint', ro.role_hint,
        'namespace_hint', ro.namespace_hint, 'page_no', ro.page_no,
        'target_candidates', ro.target_candidates_json,
        'char_start', ro.char_start, 'char_end', ro.char_end,
        'context_text', ro.context_text,
        'metadata', ro.metadata_json,
        'bucket_document_id', ro.bucket_document_id,
        'document_id', ro.document_id, 'file_binary_id', ro.file_binary_id,
        'document_representation_id', ro.document_representation_id,
        'document_segment_id', ro.document_segment_id,
        'observer_key', ro.observer_key, 'observer_version', ro.observer_version,
        'source_processor_key', source_dr.processor_key,
        'source_processor_version', source_dr.processor_version,
        'source_occurrence_reference', source_bucket.reference_number,
        'source_process_number', source_case.processo,
        'confidence', ro.confidence, 'review_state', ro.review_state,
        'review', CASE WHEN review.reference_observation_id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'namespace_hint', review.namespace_hint, 'role_hint', review.role_hint,
            'target_candidates', review.target_candidates_json,
            'resolution_state', review.resolution_state,
            'confidence', review.confidence, 'review_state', review.review_state,
            'review_note', review.review_note, 'reviewer_key', review.reviewer_key,
            'metadata', review.metadata_json,
            'created_at', review.created_at, 'updated_at', review.updated_at
          ) END
      ) ORDER BY ro.id) AS references
      FROM casework.reference_observation ro
      LEFT JOIN casework.document_representation source_dr
        ON source_dr.id = ro.document_representation_id
      LEFT JOIN casework.bucket_document source_bd ON source_bd.id = ro.bucket_document_id
      LEFT JOIN casework.bucket source_bucket ON source_bucket.id = source_bd.bucket_id
      LEFT JOIN casework.case_file source_case ON source_case.id = source_bucket.case_file_id
      LEFT JOIN casework.reference_observation_review review
        ON review.reference_observation_id = ro.id
      WHERE ro.file_binary_id = dr.file_binary_id
        AND ro.document_segment_id IS DISTINCT FROM ds.id
    ) context_refs ON true
    WHERE ds.search_vector @@ websearch_to_tsquery('portuguese', $1)
      AND ($3::text[] IS NULL OR fb.sha256 = ANY($3::text[]))
    ORDER BY rank DESC, ds.id ASC
    LIMIT $2
  `, [query, boundedLimit, sha256s]);
  return result.rows;
}
