const FILE_STATES = new Set(["available", "missing"]);

function positiveInteger(value, name, { maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    const error = new Error(`${name} must be a positive integer`);
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  return parsed;
}

function optionalText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function calendarDate(value, name) {
  const normalized = optionalText(value);
  if (!normalized) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(normalized);
  if (!match) {
    const error = new Error(`${name} must use YYYY-MM-DD`);
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== normalized) {
    const error = new Error(`${name} must be a valid calendar date`);
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  return normalized;
}

export function normalizeCourtRecordQuery(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("court-record filters must be an object");
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  const allowed = new Set([
    "court_id", "case_file_id", "bucket_id", "bucket_document_id", "document_id", "file_binary_id",
    "process_number", "occurrence_reference", "source_bucket_id", "source_document_reference",
    "document_name_contains", "document_type", "date_from", "date_to", "binary_sha256",
    "file_availability", "limit", "offset",
  ]);
  const unknown = Object.keys(input).find((key) => !allowed.has(key));
  if (unknown) {
    const error = new Error(`unknown court-record filter: ${unknown}`);
    error.code = "UNKNOWN_COURT_RECORD_FILTER";
    throw error;
  }
  const dateFrom = calendarDate(input.date_from, "date_from");
  const dateTo = calendarDate(input.date_to, "date_to");
  if (dateFrom && dateTo && dateFrom > dateTo) {
    const error = new Error("date_from must not be after date_to");
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  const sha256 = optionalText(input.binary_sha256)?.toLowerCase() ?? null;
  if (sha256 && !/^[0-9a-f]{64}$/u.test(sha256)) {
    const error = new Error("binary_sha256 must contain 64 hexadecimal characters");
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  const availability = optionalText(input.file_availability)?.toLowerCase() ?? null;
  if (availability && !FILE_STATES.has(availability)) {
    const error = new Error("file_availability must be available or missing");
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  const limit = input.limit === undefined ? 20 : positiveInteger(input.limit, "limit", { maximum: 100 });
  const offsetValue = input.offset === undefined ? 0 : Number(input.offset);
  if (!Number.isInteger(offsetValue) || offsetValue < 0 || offsetValue > 1_000_000) {
    const error = new Error("offset must be an integer from 0 through 1000000");
    error.code = "INVALID_COURT_RECORD_FILTER";
    throw error;
  }
  return {
    court_id: positiveInteger(input.court_id, "court_id"),
    case_file_id: positiveInteger(input.case_file_id, "case_file_id"),
    bucket_id: positiveInteger(input.bucket_id, "bucket_id"),
    bucket_document_id: positiveInteger(input.bucket_document_id, "bucket_document_id"),
    document_id: positiveInteger(input.document_id, "document_id"),
    file_binary_id: positiveInteger(input.file_binary_id, "file_binary_id"),
    process_number: optionalText(input.process_number),
    occurrence_reference: optionalText(input.occurrence_reference),
    source_bucket_id: optionalText(input.source_bucket_id),
    source_document_reference: optionalText(input.source_document_reference),
    document_name_contains: optionalText(input.document_name_contains),
    document_type: optionalText(input.document_type),
    date_from: dateFrom,
    date_to: dateTo,
    binary_sha256: sha256,
    file_availability: availability,
    limit,
    offset: offsetValue,
  };
}

function relation(kind, sourceKind, sourceId, targetKind, targetId) {
  return {
    relation_id: `${kind}:${sourceKind}:${sourceId}:${targetKind}:${targetId}`,
    kind,
    source: { kind: sourceKind, id: sourceId },
    target: { kind: targetKind, id: targetId },
    basis: "source_recorded",
    resolution_state: "recorded_not_independently_verified",
  };
}

function mapRecord(row) {
  const binaries = (row.binaries ?? []).map((binary) => ({
    document_binary_id: Number(binary.document_binary_id),
    file_binary_id: Number(binary.file_binary_id),
    sha256: binary.sha256,
    mime_type: binary.mime_type,
    file_extension: binary.file_extension,
    size_bytes: binary.size_bytes === null ? null : Number(binary.size_bytes),
    retention_status: binary.retention_status,
    integrity_check_status: binary.integrity_check_status,
    machine_readability_status: binary.machine_readability_status,
    is_primary: binary.is_primary,
    match_confidence: binary.match_confidence,
    source_observation_count: Number(binary.source_observation_count),
    details_tool: "get_binary_details",
  }));
  const relationships = [
    relation("has_occurrence", "case_file", Number(row.case_file_id), "bucket", Number(row.bucket_id)),
    relation("contains", "bucket", Number(row.bucket_id), "source_document", Number(row.document_id)),
    ...binaries.map((binary) => relation("represented_by", "source_document", Number(row.document_id), "binary", binary.file_binary_id)),
  ];
  return {
    record_identity: { bucket_document_id: Number(row.bucket_document_id), source_system: row.bucket_source_system },
    court: {
      court_id: Number(row.court_id), country_id: row.country_id, source_system: row.court_source_system,
      source_court_id: row.source_court_id, source_unit_id: row.source_unit_id,
      source_client_id: row.source_client_id, name: row.tribunal_name, unit: row.unit_name,
      canonical_confidence: row.court_confidence,
    },
    case: {
      case_file_id: Number(row.case_file_id), source_system: row.case_source_system,
      process_number: row.process_number, source_process_id: row.source_process_id,
      classification: row.case_classification, status: row.case_status,
      registration_date: row.registration_date, decision_date: row.decision_date,
      parent_case_file_id: row.parent_case_file_id === null ? null : Number(row.parent_case_file_id),
      is_base_case: row.is_base_case, scope_status: row.case_scope_status,
      canonical_confidence: row.case_confidence,
    },
    occurrence: {
      bucket_id: Number(row.bucket_id), source_bucket_id: row.source_bucket_id,
      source_system: row.bucket_source_system, reference: row.occurrence_reference,
      recorded_date: row.occurrence_date, date_semantics: "source-recorded procedural occurrence date",
      designation: row.designation, presenter: row.presenter, modal_title: row.modal_title,
      source_document_count: row.source_document_count === null ? null : Number(row.source_document_count),
      canonical_confidence: row.bucket_confidence,
    },
    document: {
      document_id: Number(row.document_id), source_system: row.document_source_system,
      source_document_reference: row.source_document_reference, source_name: row.document_name,
      source_anchor_title: row.document_anchor_title, recorded_document_date: row.document_date,
      source_type: row.document_type, source_type_attribute: row.document_type_from_attr,
      identity_class: row.document_identity_class,
      claimed_size_bytes: row.claimed_size_bytes === null ? null : Number(row.claimed_size_bytes),
      canonical_confidence: row.document_confidence,
      occurrence_link: {
        source_observation_count: Number(row.bucket_document_observation_count),
        has_intra_bucket_duplication: row.has_intra_bucket_duplication,
        canonical_confidence: row.bucket_document_confidence,
      },
    },
    binaries,
    file_state: {
      status: binaries.length ? "available" : "missing",
      basis: binaries.length ? "one_or_more_source-associated binaries" : "no binary associated with this source document",
    },
    relationships,
  };
}

export async function queryCourtRecords(client, input = {}) {
  const query = normalizeCourtRecordQuery(input);
  const params = [
    query.court_id, query.case_file_id, query.bucket_id, query.bucket_document_id, query.document_id,
    query.file_binary_id, query.process_number, query.occurrence_reference, query.source_bucket_id,
    query.source_document_reference, query.document_name_contains, query.document_type, query.date_from,
    query.date_to, query.binary_sha256, query.file_availability, query.limit, query.offset,
  ];
  const result = await client.query(`
    SELECT
      COUNT(*) OVER() AS total_count,
      bd.id AS bucket_document_id, bd.source_observation_count AS bucket_document_observation_count,
      bd.has_intra_bucket_duplication, bd.canonical_confidence AS bucket_document_confidence,
      court.id AS court_id, court.country_id, court.source_system AS court_source_system,
      court.tribunal_name, court.unit_name, court.idtribref AS source_court_id,
      court.idunorgref AS source_unit_id, court.idcliente AS source_client_id,
      court.canonical_confidence AS court_confidence,
      cf.id AS case_file_id, cf.source_system AS case_source_system, cf.processo AS process_number,
      cf.idprocesso AS source_process_id, cf.especie AS case_classification, cf.estado AS case_status,
      to_char(cf.data_autuacao, 'YYYY-MM-DD') AS registration_date,
      to_char(cf.data_decisao, 'YYYY-MM-DD') AS decision_date,
      cf.parent_case_file_id, cf.is_base_case, cf.case_scope_status,
      cf.canonical_confidence AS case_confidence,
      b.id AS bucket_id, b.source_system AS bucket_source_system, b.bucket_id AS source_bucket_id,
      b.reference_number AS occurrence_reference,
      to_char(b.bucket_date, 'YYYY-MM-DD') AS occurrence_date,
      b.designation, b.presenter, b.modal_title, b.document_count AS source_document_count,
      b.canonical_confidence AS bucket_confidence,
      d.id AS document_id, d.source_system AS document_source_system,
      d.document_procinfo AS source_document_reference, d.document_name, d.document_anchor_title,
      to_char(d.document_date, 'YYYY-MM-DD') AS document_date,
      d.document_type, d.document_type_from_attr, d.document_identity_class,
      d.claimed_size_bytes, d.canonical_confidence AS document_confidence,
      COALESCE(binary_rows.binaries, '[]'::jsonb) AS binaries
    FROM casework.bucket_document bd
    JOIN casework.bucket b ON b.id = bd.bucket_id
    JOIN casework.case_file cf ON cf.id = b.case_file_id
    JOIN casework.court court ON court.id = cf.court_id
    JOIN casework.document d ON d.id = bd.document_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'document_binary_id', db.id, 'file_binary_id', fb.id, 'sha256', fb.sha256,
        'mime_type', fb.mime_type, 'file_extension', fb.file_extension,
        'size_bytes', fb.actual_size_bytes, 'retention_status', fb.retention_status,
        'integrity_check_status', fb.integrity_check_status,
        'machine_readability_status', fb.machine_readability_status,
        'is_primary', db.is_primary, 'match_confidence', db.match_confidence,
        'source_observation_count', db.source_observation_count
      ) ORDER BY db.is_primary DESC, fb.sha256 ASC) AS binaries
      FROM casework.document_binary db
      JOIN casework.file_binary fb ON fb.id = db.file_binary_id
      WHERE db.document_id = d.id
    ) binary_rows ON true
    WHERE ($1::bigint IS NULL OR court.id = $1)
      AND ($2::bigint IS NULL OR cf.id = $2)
      AND ($3::bigint IS NULL OR b.id = $3)
      AND ($4::bigint IS NULL OR bd.id = $4)
      AND ($5::bigint IS NULL OR d.id = $5)
      AND ($6::bigint IS NULL OR EXISTS (SELECT 1 FROM casework.document_binary fdb WHERE fdb.document_id = d.id AND fdb.file_binary_id = $6))
      AND ($7::text IS NULL OR cf.processo = $7)
      AND ($8::text IS NULL OR b.reference_number = $8)
      AND ($9::text IS NULL OR b.bucket_id = $9)
      AND ($10::text IS NULL OR d.document_procinfo = $10)
      AND ($11::text IS NULL OR d.document_name ILIKE '%' || $11 || '%')
      AND ($12::text IS NULL OR d.document_type = $12)
      AND ($13::date IS NULL OR b.bucket_date >= $13)
      AND ($14::date IS NULL OR b.bucket_date <= $14)
      AND ($15::text IS NULL OR EXISTS (
        SELECT 1 FROM casework.document_binary sdb JOIN casework.file_binary sfb ON sfb.id = sdb.file_binary_id
        WHERE sdb.document_id = d.id AND sfb.sha256 = $15
      ))
      AND ($16::text IS NULL
        OR ($16 = 'available' AND EXISTS (SELECT 1 FROM casework.document_binary adb WHERE adb.document_id = d.id))
        OR ($16 = 'missing' AND NOT EXISTS (SELECT 1 FROM casework.document_binary mdb WHERE mdb.document_id = d.id)))
    ORDER BY b.bucket_date ASC NULLS LAST, cf.processo ASC, b.id ASC, bd.id ASC
    LIMIT $17 OFFSET $18
  `, params);
  const items = result.rows.map(mapRecord);
  // An out-of-range OFFSET removes the window row that carries COUNT(*).
  // Keep that total unknown instead of incorrectly reporting no matches.
  const totalCount = result.rows.length
    ? Number(result.rows[0].total_count)
    : query.offset === 0 ? 0 : null;
  return {
    schema_version: 1,
    read_model: "court_occurrence_document_records",
    query,
    pagination: {
      unit: "bucket_document_occurrence_records", limit: query.limit, offset: query.offset,
      returned: items.length, total_matching: totalCount,
      has_more: totalCount === null ? false : query.offset + items.length < totalCount,
      next_offset: totalCount !== null && query.offset + items.length < totalCount
        ? query.offset + items.length
        : null,
    },
    coverage: {
      source: "imported court-system metadata",
      scope: "all imported bucket-document associations matching the query",
      no_match_does_not_prove_absence_from_the_original_court_file: true,
    },
    semantics: {
      result_unit: "one source document associated with one procedural occurrence",
      source_labels_are_not_verified_document_classifications: true,
      occurrence_is_not_binary_identity: true,
      missing_binary_is_not_extraction_failure: true,
      relationships_are_recorded_structure_not_resolved_legal_meaning: true,
    },
    items,
  };
}
