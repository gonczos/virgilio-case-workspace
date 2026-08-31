import {
  DEFAULT_SELECTION_PURPOSE,
  getWorkspaceRoot,
} from "./processing-common.mjs";
import {
  deriveRepresentationAttention,
  deriveRepresentationAttentionState,
  getBinaryRowBySha,
  getRepresentationById,
  getRepresentationText,
  listComparisonsForBinary,
  listRepresentationsForBinary,
  resolveEffectiveRepresentation,
  resolveEffectiveRepresentationState,
} from "./processing-store.mjs";
import {
  hasRepresentationArtifactFormat,
  readRepresentationArtifact,
} from "./representation-artifacts.mjs";

function notFound(message) {
  const error = new Error(message);
  error.code = "NOT_FOUND";
  return error;
}

export function normalizeSha256(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidSha256(value) {
  return /^[0-9a-f]{64}$/u.test(normalizeSha256(value));
}

export function parsePositiveInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

export function sanitizeErrorText(errorText) {
  if (!errorText) {
    return null;
  }
  const firstLine = String(errorText)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return null;
  }
  return firstLine
    .replace(/[A-Za-z]:\\[^\s'"]+/gu, "[path]")
    .replace(/\/workspace\/[^\s'"]+/gu, "[path]")
    .replace(/\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+){2,}/gu, "[path]");
}

export function buildBinaryDisplayName({
  linkedDocumentNames,
  documentCount,
  mimeType,
  fileExtension,
  sha256,
}) {
  const names = linkedDocumentNames.filter(Boolean);
  if (documentCount === 1 && names.length > 0) {
    return names[0];
  }
  if (documentCount > 1 && names.length === 1) {
    return names[0];
  }
  if (names.length > 1) {
    return "Multiple linked documents";
  }
  const kind = fileExtension
    ? String(fileExtension).replace(/^\./u, "").toUpperCase()
    : mimeType === "application/pdf"
      ? "PDF"
      : mimeType === "text/plain"
        ? "TXT"
        : "BIN";
  return `${kind} ${String(sha256).slice(0, 8)}`;
}

function buildReasonCodes(attention) {
  return attention.reasons.map((reason) => reason.reason_code);
}

async function determineRepresentationAvailableFormats(workspaceRoot, representation) {
  const formats = [];
  if (Number(representation.segment_count ?? 0) > 0) {
    formats.push("text");
  }
  if (await hasRepresentationArtifactFormat(workspaceRoot, representation, "markdown")) {
    formats.push("markdown");
  }
  if (await hasRepresentationArtifactFormat(workspaceRoot, representation, "complete-text")) {
    formats.push("complete-text");
  }
  if (await hasRepresentationArtifactFormat(workspaceRoot, representation, "native-json")) {
    formats.push("native-json");
  }
  return formats;
}

async function buildRepresentationViewModel(workspaceRoot, representation, selection = null) {
  const availableFormats = await determineRepresentationAvailableFormats(workspaceRoot, representation);
  return {
    representation_id: representation.id,
    representation_source_kind: representation.representation_source_kind,
    representation_variant_key: representation.representation_variant_key,
    representation_kind: representation.representation_kind,
    format_family: representation.format_family,
    processor_key: representation.processor_key,
    processor_version: representation.processor_version,
    created_at: representation.created_at,
    based_on_representation_id: representation.based_on_representation_id,
    produced_by_job_id: representation.produced_by_job_id,
    produced_by_job_status: representation.produced_by_job_status ?? null,
    available_formats: availableFormats,
    is_effective: selection?.representation?.id === representation.id,
    is_explicitly_selected: selection?.explicit_selection?.selected_representation_id === representation.id,
  };
}

async function listBinaryRepresentationRows(client, fileBinaryIds) {
  if (fileBinaryIds.length === 0) {
    return [];
  }
  const result = await client.query(
    `
      SELECT
        dr.*,
        pj.status AS produced_by_job_status,
        COUNT(ds.id) AS segment_count
      FROM casework.document_representation AS dr
      JOIN casework.processing_job AS pj
        ON pj.id = dr.produced_by_job_id
      LEFT JOIN casework.document_segment AS ds
        ON ds.document_representation_id = dr.id
      WHERE dr.file_binary_id = ANY($1::bigint[])
      GROUP BY dr.id, pj.status
      ORDER BY dr.file_binary_id ASC, dr.created_at ASC, dr.id ASC
    `,
    [fileBinaryIds],
  );
  return result.rows;
}

async function listBinarySelections(client, fileBinaryIds) {
  if (fileBinaryIds.length === 0) {
    return [];
  }
  const result = await client.query(
    `
      SELECT *
      FROM casework.document_representation_selection
      WHERE file_binary_id = ANY($1::bigint[])
        AND selection_purpose = $2
    `,
    [fileBinaryIds, DEFAULT_SELECTION_PURPOSE],
  );
  return result.rows;
}

async function listBinaryComparisons(client, fileBinaryIds) {
  if (fileBinaryIds.length === 0) {
    return [];
  }
  const result = await client.query(
    `
      SELECT *
      FROM casework.document_representation_comparison
      WHERE file_binary_id = ANY($1::bigint[])
      ORDER BY file_binary_id ASC, id ASC
    `,
    [fileBinaryIds],
  );
  return result.rows;
}

async function listBinaryJobRows(client, fileBinaryIds) {
  if (fileBinaryIds.length === 0) {
    return [];
  }
  const result = await client.query(
    `
      SELECT
        id,
        file_binary_id,
        document_representation_id,
        stage_key,
        status,
        processor_key,
        processor_version,
        requested_by,
        requested_at,
        started_at,
        completed_at,
        attempt_count,
        max_attempts,
        error_code,
        error_text
      FROM casework.processing_job
      WHERE file_binary_id = ANY($1::bigint[])
      ORDER BY requested_at DESC, id DESC
    `,
    [fileBinaryIds],
  );
  return result.rows;
}

function buildProcessingSummary(jobRows) {
  const statusCounts = {};
  const processorKeys = new Set();
  let lastProcessedAt = null;
  for (const job of jobRows) {
    statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1;
    if (job.processor_key) {
      processorKeys.add(job.processor_key);
    }
    const candidate = job.completed_at ?? job.started_at ?? job.requested_at ?? null;
    if (candidate && (lastProcessedAt === null || candidate > lastProcessedAt)) {
      lastProcessedAt = candidate;
    }
  }
  return {
    total_jobs: jobRows.length,
    status_counts: statusCounts,
    processor_keys: [...processorKeys].sort(),
    last_processed_at: lastProcessedAt,
  };
}

async function buildCatalogueSelectionState(workspaceRoot, rows, selectionMap, comparisonMap) {
  const selection = resolveEffectiveRepresentationState({
    representations: rows,
    explicitSelection: selectionMap.get(rows[0]?.file_binary_id) ?? null,
    purpose: DEFAULT_SELECTION_PURPOSE,
  });
  const representationItems = await Promise.all(
    rows.map((row) => buildRepresentationViewModel(workspaceRoot, row, selection)),
  );
  const attention = deriveRepresentationAttentionState({
    effectiveSelection: selection,
    comparisons: comparisonMap.get(rows[0]?.file_binary_id) ?? [],
  });
  return {
    selection,
    attention,
    representationItems,
  };
}

export async function listConsultationBinaries(client, {
  workspaceRoot = getWorkspaceRoot(),
  limit = 200,
  offset = 0,
} = {}) {
  const baseResult = await client.query(
    `
      SELECT
        fb.id AS file_binary_id,
        fb.sha256,
        fb.mime_type,
        fb.file_extension,
        fb.actual_size_bytes AS size_bytes,
        COUNT(DISTINCT db.document_id) AS document_count,
        COUNT(DISTINCT b.id) AS bucket_count,
        COUNT(DISTINCT cf.id) AS case_count,
        COALESCE(
          ARRAY_AGG(DISTINCT NULLIF(BTRIM(d.document_name), ''))
            FILTER (WHERE NULLIF(BTRIM(d.document_name), '') IS NOT NULL),
          ARRAY[]::text[]
        ) AS linked_document_names,
        COALESCE(
          ARRAY_AGG(DISTINCT NULLIF(BTRIM(cf.processo), ''))
            FILTER (WHERE NULLIF(BTRIM(cf.processo), '') IS NOT NULL),
          ARRAY[]::text[]
        ) AS linked_case_refs
      FROM casework.file_binary AS fb
      LEFT JOIN casework.document_binary AS db
        ON db.file_binary_id = fb.id
      LEFT JOIN casework.document AS d
        ON d.id = db.document_id
      LEFT JOIN casework.bucket_document AS bd
        ON bd.document_id = d.id
      LEFT JOIN casework.bucket AS b
        ON b.id = bd.bucket_id
      LEFT JOIN casework.case_file AS cf
        ON cf.id = b.case_file_id
      GROUP BY fb.id, fb.sha256, fb.mime_type, fb.file_extension, fb.actual_size_bytes
    `,
  );
  const baseRows = baseResult.rows;
  const fileBinaryIds = baseRows.map((row) => row.file_binary_id);
  const representationRows = await listBinaryRepresentationRows(client, fileBinaryIds);
  const selectionRows = await listBinarySelections(client, fileBinaryIds);
  const comparisonRows = await listBinaryComparisons(client, fileBinaryIds);
  const jobRows = await listBinaryJobRows(client, fileBinaryIds);
  const representationMap = new Map();
  for (const row of representationRows) {
    const rows = representationMap.get(row.file_binary_id) ?? [];
    rows.push(row);
    representationMap.set(row.file_binary_id, rows);
  }
  const selectionMap = new Map(selectionRows.map((row) => [row.file_binary_id, row]));
  const comparisonMap = new Map();
  for (const row of comparisonRows) {
    const rows = comparisonMap.get(row.file_binary_id) ?? [];
    rows.push(row);
    comparisonMap.set(row.file_binary_id, rows);
  }
  const jobMap = new Map();
  for (const row of jobRows) {
    const rows = jobMap.get(row.file_binary_id) ?? [];
    rows.push(row);
    jobMap.set(row.file_binary_id, rows);
  }
  const items = [];
  for (const row of baseRows) {
    const representations = representationMap.get(row.file_binary_id) ?? [];
    const { selection, attention, representationItems } = await buildCatalogueSelectionState(
      workspaceRoot,
      representations,
      selectionMap,
      comparisonMap,
    );
    const linkedDocumentNames = row.linked_document_names ?? [];
    const processingSummary = buildProcessingSummary(jobMap.get(row.file_binary_id) ?? []);
    const item = {
      file_binary_id: row.file_binary_id,
      sha256: row.sha256,
      display_name: buildBinaryDisplayName({
        linkedDocumentNames,
        documentCount: Number(row.document_count ?? 0),
        mimeType: row.mime_type,
        fileExtension: row.file_extension,
        sha256: row.sha256,
      }),
      mime_type: row.mime_type,
      file_extension: row.file_extension,
      size_bytes: row.size_bytes === null ? null : Number(row.size_bytes),
      document_count: Number(row.document_count ?? 0),
      bucket_count: Number(row.bucket_count ?? 0),
      case_count: Number(row.case_count ?? 0),
      linked_document_names: linkedDocumentNames,
      linked_case_refs: row.linked_case_refs ?? [],
      processing_summary: processingSummary,
      available_representations: representationItems,
      effective_representation: selection.representation
        ? {
            representation_id: selection.representation.id,
            processor_key: selection.representation.processor_key,
            processor_version: selection.representation.processor_version,
            representation_source_kind: selection.representation.representation_source_kind,
          }
        : null,
      effective_selection_reason: selection.selection_source,
      review_needed: attention.review_needed,
      review_reason_codes: buildReasonCodes(attention),
      last_processed_at: processingSummary.last_processed_at,
    };
    items.push(item);
  }
  items.sort((left, right) => {
    const nameOrder = left.display_name.localeCompare(right.display_name, "en");
    if (nameOrder !== 0) {
      return nameOrder;
    }
    return left.sha256.localeCompare(right.sha256, "en");
  });
  return {
    total_count: items.length,
    limit,
    offset,
    items: items.slice(offset, offset + limit),
  };
}

async function listContextDocuments(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT
        d.id AS document_id,
        d.document_name,
        d.document_date,
        d.document_type,
        d.document_identity_class,
        db.is_primary AS is_primary_binary,
        db.source_observation_count
      FROM casework.document_binary AS db
      JOIN casework.document AS d
        ON d.id = db.document_id
      WHERE db.file_binary_id = $1
      ORDER BY db.is_primary DESC, d.document_date ASC NULLS LAST, d.document_name ASC NULLS LAST, d.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows.map((row) => ({
    document_id: row.document_id,
    document_name: row.document_name,
    document_date: row.document_date,
    document_type: row.document_type,
    document_identity_class: row.document_identity_class,
    is_primary_binary: row.is_primary_binary,
    source_observation_count: row.source_observation_count === null ? null : Number(row.source_observation_count),
  }));
}

async function listContextBuckets(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        b.id AS bucket_pk_id,
        b.bucket_id,
        b.bucket_date,
        b.designation,
        b.reference_number,
        b.presenter,
        cf.id AS case_file_id,
        cf.processo
      FROM casework.document_binary AS db
      JOIN casework.bucket_document AS bd
        ON bd.document_id = db.document_id
      JOIN casework.bucket AS b
        ON b.id = bd.bucket_id
      JOIN casework.case_file AS cf
        ON cf.id = b.case_file_id
      WHERE db.file_binary_id = $1
      ORDER BY b.bucket_date ASC NULLS LAST, b.bucket_id ASC, b.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows.map((row) => ({
    bucket_pk_id: row.bucket_pk_id,
    bucket_id: row.bucket_id,
    bucket_date: row.bucket_date,
    designation: row.designation,
    reference_number: row.reference_number,
    presenter: row.presenter,
    case_file_id: row.case_file_id,
    processo: row.processo,
  }));
}

async function listContextCases(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        cf.id AS case_file_id,
        cf.processo,
        cf.idprocesso,
        cf.especie,
        cf.estado,
        cf.data_autuacao,
        cf.case_workspace_id
      FROM casework.document_binary AS db
      JOIN casework.bucket_document AS bd
        ON bd.document_id = db.document_id
      JOIN casework.bucket AS b
        ON b.id = bd.bucket_id
      JOIN casework.case_file AS cf
        ON cf.id = b.case_file_id
      WHERE db.file_binary_id = $1
      ORDER BY cf.processo ASC, cf.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listContextWorkspaces(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        cw.id AS case_workspace_id,
        cw.workspace_code,
        cw.title,
        cw.lifecycle_status
      FROM casework.document_binary AS db
      JOIN casework.bucket_document AS bd
        ON bd.document_id = db.document_id
      JOIN casework.bucket AS b
        ON b.id = bd.bucket_id
      JOIN casework.case_file AS cf
        ON cf.id = b.case_file_id
      JOIN casework.case_workspace AS cw
        ON cw.id = cf.case_workspace_id
      WHERE db.file_binary_id = $1
      ORDER BY cw.workspace_code ASC, cw.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listDetailJobs(client, fileBinaryId, representations) {
  const representationByJobId = new Map(
    representations.map((representation) => [representation.produced_by_job_id, representation.id]),
  );
  const result = await client.query(
    `
      SELECT
        id,
        stage_key,
        status,
        processor_key,
        processor_version,
        requested_by,
        requested_at,
        started_at,
        completed_at,
        attempt_count,
        max_attempts,
        error_code,
        error_text
      FROM casework.processing_job
      WHERE file_binary_id = $1
      ORDER BY requested_at DESC, id DESC
    `,
    [fileBinaryId],
  );
  return result.rows.map((row) => ({
    processing_job_id: row.id,
    stage_key: row.stage_key,
    status: row.status,
    processor_key: row.processor_key,
    processor_version: row.processor_version,
    requested_by: row.requested_by,
    requested_at: row.requested_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    attempt_count: Number(row.attempt_count),
    max_attempts: Number(row.max_attempts),
    error_code: row.error_code,
    error_message: sanitizeErrorText(row.error_text),
    produced_representation_id: representationByJobId.get(row.id) ?? null,
  }));
}

function buildComparisonViewModel(comparison) {
  return {
    comparison_id: comparison.id,
    left_representation_id: comparison.representation_a_id,
    right_representation_id: comparison.representation_b_id,
    comparison_kind: comparison.comparison_kind,
    comparator_key: comparison.comparator_key,
    comparator_version: comparison.comparator_version,
    disagreement_level: comparison.summary_json?.disagreement_level ?? null,
    summary: comparison.summary_json ?? {},
    created_at: comparison.created_at ?? null,
  };
}

export async function getConsultationBinaryDetail(client, sha256, {
  workspaceRoot = getWorkspaceRoot(),
} = {}) {
  const normalizedSha256 = normalizeSha256(sha256);
  if (!isValidSha256(normalizedSha256)) {
    const error = new Error(`Invalid SHA-256: ${sha256}`);
    error.code = "INVALID_SHA256";
    throw error;
  }
  const binaryRow = await getBinaryRowBySha(client, normalizedSha256);
  const documents = await listContextDocuments(client, binaryRow.id);
  const buckets = await listContextBuckets(client, binaryRow.id);
  const cases = await listContextCases(client, binaryRow.id);
  const workspaces = await listContextWorkspaces(client, binaryRow.id);
  const state = await inspectDetailState(client, binaryRow.id, workspaceRoot);
  const jobs = await listDetailJobs(client, binaryRow.id, state.rawRepresentations);
  return {
    binary: {
      file_binary_id: binaryRow.id,
      sha256: binaryRow.sha256,
      mime_type: binaryRow.mime_type,
      file_extension: binaryRow.file_extension,
      machine_readability_status: binaryRow.machine_readability_status,
      page_count: binaryRow.page_count === null ? null : Number(binaryRow.page_count),
      size_bytes: binaryRow.actual_size_bytes === null ? null : Number(binaryRow.actual_size_bytes),
      display_name: buildBinaryDisplayName({
        linkedDocumentNames: documents.map((item) => item.document_name).filter(Boolean),
        documentCount: documents.length,
        mimeType: binaryRow.mime_type,
        fileExtension: binaryRow.file_extension,
        sha256: binaryRow.sha256,
      }),
      original_binary_url: `/binary/${binaryRow.sha256}`,
    },
    context: {
      documents,
      buckets,
      cases,
      workspaces,
    },
    processing: {
      jobs,
      summary: buildProcessingSummary(jobs),
    },
    representations: {
      items: state.representationItems,
      effective: state.selection.representation
        ? {
            representation_id: state.selection.representation.id,
            processor_key: state.selection.representation.processor_key,
            processor_version: state.selection.representation.processor_version,
            representation_source_kind: state.selection.representation.representation_source_kind,
          }
        : null,
      explicit_selection: state.selection.explicit_selection,
      effective_selection_reason: state.selection.selection_source,
    },
    comparisons: state.comparisonItems,
    attention: {
      review_needed: state.attention.review_needed,
      reason_codes: buildReasonCodes(state.attention),
      reasons: state.attention.reasons,
    },
    provenance: {
      effective_representation_id: state.selection.representation?.id ?? null,
      selection_source: state.selection.selection_source,
      explicit_selection_id: state.selection.explicit_selection?.id ?? null,
    },
    technical_details: {
      binary_id: binaryRow.id,
      representation_ids: state.representationItems.map((item) => item.representation_id),
      comparison_ids: state.comparisonItems.map((item) => item.comparison_id),
    },
  };
}

async function inspectDetailState(client, fileBinaryId, workspaceRoot) {
  const representations = await listRepresentationsForBinary(client, fileBinaryId);
  const selection = await resolveEffectiveRepresentation(client, { fileBinaryId });
  const comparisons = await listComparisonsForBinary(client, fileBinaryId);
  const attention = await deriveRepresentationAttention(client, fileBinaryId);
  const representationItems = await Promise.all(
    representations.map((representation) => buildRepresentationViewModel(workspaceRoot, representation, selection)),
  );
  return {
    rawRepresentations: representations,
    selection,
    attention,
    comparisonItems: comparisons.map(buildComparisonViewModel),
    representationItems,
  };
}

export async function getRepresentationContent(client, representationId, format, {
  workspaceRoot = getWorkspaceRoot(),
} = {}) {
  const normalizedFormat = String(format ?? "").trim().toLowerCase();
  const parsedId = parsePositiveInteger(representationId, null, { min: 1 });
  if (parsedId === null) {
    const error = new Error(`Invalid representation id: ${representationId}`);
    error.code = "INVALID_REPRESENTATION_ID";
    throw error;
  }
  if (
    normalizedFormat !== "text"
    && normalizedFormat !== "markdown"
    && normalizedFormat !== "complete-text"
    && normalizedFormat !== "native-json"
  ) {
    const error = new Error(`Invalid representation format: ${format}`);
    error.code = "INVALID_REPRESENTATION_FORMAT";
    throw error;
  }
  let representation;
  try {
    representation = await getRepresentationById(client, parsedId);
  } catch (error) {
    if (error?.code === "NOT_FOUND") {
      throw error;
    }
    throw error;
  }
  if (normalizedFormat === "text") {
    const body = await getRepresentationText(client, parsedId);
    return {
      contentType: "text/plain; charset=utf-8",
      body,
    };
  }
  return readRepresentationArtifact(workspaceRoot, representation, normalizedFormat);
}
