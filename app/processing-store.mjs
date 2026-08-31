import fs from "node:fs/promises";
import path from "node:path";

import {
  COMPARATOR_KEY,
  COMPARATOR_VERSION,
  DEFAULT_SELECTION_PURPOSE,
  QUICK_PREVIEW_PURPOSE,
  buildHumanVariantKey,
  ensureDir,
  getWorkspaceRoot,
  makeTempDir,
  sleep,
  withTransaction,
  writeJson,
  writeText,
} from "./processing-common.mjs";
import {
  DEFAULT_COMPARISON_KIND,
  buildComparisonObservation,
  canonicalizeComparisonPair,
} from "./processing-comparison.mjs";
import {
  DEFAULT_REPRESENTATION_KIND,
  EXTRACT_STAGE_KEY,
  HUMAN_STAGE_KEY,
  determineProcessingPolicy,
  getProcessingOutputRoot,
  getProcessor,
} from "./processing-registry.mjs";

export const HUMAN_PROCESSOR_KEY = "human";
export const HUMAN_PROCESSOR_VERSION = "manual-v1";
export const ACTIVE_JOB_STATUSES = ["queued", "running"];
export const TERMINAL_JOB_STATUSES = ["completed", "failed", "cancelled", "blocked"];

function notFound(message) {
  const error = new Error(message);
  error.code = "NOT_FOUND";
  return error;
}

export async function getBinaryRowBySha(client, sha256) {
  const result = await client.query(
    `
      SELECT
        id,
        sha256,
        mime_type,
        file_extension,
        storage_package_id,
        storage_rel_path,
        machine_readability_status,
        page_count,
        actual_size_bytes
      FROM casework.file_binary
      WHERE sha256 = $1
    `,
    [sha256],
  );
  if (result.rowCount !== 1) {
    throw notFound(`Unknown file_binary sha256: ${sha256}`);
  }
  return result.rows[0];
}

export async function getBinaryRowById(client, id) {
  const result = await client.query(
    `
      SELECT
        id,
        sha256,
        mime_type,
        file_extension,
        storage_package_id,
        storage_rel_path,
        machine_readability_status,
        page_count,
        actual_size_bytes
      FROM casework.file_binary
      WHERE id = $1
    `,
    [id],
  );
  if (result.rowCount !== 1) {
    throw notFound(`Unknown file_binary id: ${id}`);
  }
  return result.rows[0];
}

export async function listRepresentationsForBinary(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT
        dr.*,
        pj.status AS produced_by_job_status,
        pj.stage_key AS produced_by_stage_key,
        pj.requested_by AS produced_by_requested_by,
        pj.completed_at AS produced_by_completed_at
      FROM casework.document_representation AS dr
      JOIN casework.processing_job AS pj
        ON pj.id = dr.produced_by_job_id
      WHERE dr.file_binary_id = $1
      ORDER BY dr.created_at ASC, dr.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

export async function getRepresentationById(client, representationId) {
  const result = await client.query(
    `
      SELECT dr.*
      FROM casework.document_representation AS dr
      WHERE dr.id = $1
    `,
    [representationId],
  );
  if (result.rowCount !== 1) {
    throw notFound(`Unknown document_representation id: ${representationId}`);
  }
  return result.rows[0];
}

export async function getRepresentationText(client, representationId) {
  const result = await client.query(
    `
      SELECT COALESCE(string_agg(COALESCE(text_content, ''), E'\n' ORDER BY sequence_no), '') AS text_content
      FROM casework.document_segment
      WHERE document_representation_id = $1
    `,
    [representationId],
  );
  return result.rows[0]?.text_content ?? "";
}

export async function getSelectionOverride(client, { fileBinaryId, purpose = DEFAULT_SELECTION_PURPOSE }) {
  const result = await client.query(
    `
      SELECT *
      FROM casework.document_representation_selection
      WHERE file_binary_id = $1
        AND selection_purpose = $2
    `,
    [fileBinaryId, purpose],
  );
  return result.rows[0] ?? null;
}

function rankForPurpose(representation, purpose) {
  if (purpose === QUICK_PREVIEW_PURPOSE) {
    if (representation.processor_key === "plain_text_passthrough") {
      return 400;
    }
    if (representation.processor_key === "xberg") {
      return 300;
    }
    if (representation.processor_key === "docling") {
      return 200;
    }
    if (representation.representation_source_kind === "human_authored") {
      return 100;
    }
    return 0;
  }
  if (representation.processor_key === "docling") {
    return 400;
  }
  if (representation.processor_key === "xberg") {
    return 300;
  }
  if (representation.processor_key === "plain_text_passthrough") {
    return 200;
  }
  if (representation.representation_source_kind === "human_authored") {
    return 100;
  }
  return 0;
}

export async function resolveEffectiveRepresentation(client, {
  fileBinaryId,
  purpose = DEFAULT_SELECTION_PURPOSE,
}) {
  const explicitSelection = await getSelectionOverride(client, { fileBinaryId, purpose });
  const representations = await listRepresentationsForBinary(client, fileBinaryId);
  if (explicitSelection) {
    const selected = representations.find((item) => item.id === explicitSelection.selected_representation_id);
    return {
      purpose,
      selection_source: "explicit_human_selection",
      representation: selected ?? null,
      explicit_selection: explicitSelection,
      representations,
    };
  }
  const ranked = [...representations].sort((left, right) => {
    const rankDelta = rankForPurpose(right, purpose) - rankForPurpose(left, purpose);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
  return {
    purpose,
    selection_source: "automatic_policy",
    representation: ranked[0] ?? null,
    explicit_selection: null,
    representations,
  };
}

export async function listComparisonsForBinary(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT *
      FROM casework.document_representation_comparison
      WHERE file_binary_id = $1
      ORDER BY id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

function attentionReason(reasonCode, detail = null) {
  return detail === null ? { reason_code: reasonCode } : { reason_code: reasonCode, detail };
}

export async function deriveRepresentationAttention(client, fileBinaryId) {
  const resolved = await resolveEffectiveRepresentation(client, { fileBinaryId });
  const comparisons = await listComparisonsForBinary(client, fileBinaryId);
  const reasons = [];
  if (resolved.representations.some((item) => item.representation_source_kind === "human_authored")) {
    reasons.push(attentionReason("human_representation_present"));
  }
  for (const comparison of comparisons) {
    const level = comparison.summary_json?.disagreement_level ?? null;
    if (level === "high" || level === "medium") {
      reasons.push(attentionReason("representation_disagreement", {
        comparison_id: comparison.id,
        disagreement_level: level,
      }));
    }
  }
  if (resolved.explicit_selection) {
    const selectedCreatedAt = new Date(resolved.representation?.created_at ?? 0).getTime();
    const newerAvailable = resolved.representations.some((item) => new Date(item.created_at).getTime() > selectedCreatedAt);
    if (newerAvailable) {
      reasons.push(attentionReason("newer_representation_after_explicit_selection"));
    }
  }
  return {
    review_needed: reasons.length > 0,
    reasons,
    effective_selection: resolved,
  };
}

export async function upsertSelectionOverride(client, {
  fileBinaryId,
  purpose = DEFAULT_SELECTION_PURPOSE,
  representationId,
  selectedBy = null,
  selectionNote = null,
}) {
  const result = await client.query(
    `
      INSERT INTO casework.document_representation_selection (
        file_binary_id,
        selection_purpose,
        selected_representation_id,
        selected_by,
        selection_note
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (file_binary_id, selection_purpose)
      DO UPDATE SET
        selected_representation_id = EXCLUDED.selected_representation_id,
        selected_by = EXCLUDED.selected_by,
        selection_note = EXCLUDED.selection_note,
        updated_at = NOW()
      RETURNING *
    `,
    [fileBinaryId, purpose, representationId, selectedBy, selectionNote],
  );
  return result.rows[0];
}

export async function clearSelectionOverride(client, { fileBinaryId, purpose = DEFAULT_SELECTION_PURPOSE }) {
  await client.query(
    `
      DELETE FROM casework.document_representation_selection
      WHERE file_binary_id = $1
        AND selection_purpose = $2
    `,
    [fileBinaryId, purpose],
  );
}

export async function createHumanRepresentation(client, {
  fileBinaryId,
  textContent,
  createdBy = null,
  selectionNote = null,
  basedOnRepresentationId = null,
  representationKind = DEFAULT_REPRESENTATION_KIND,
  formatFamily = "text",
}) {
  const variantKey = buildHumanVariantKey({ createdBy: createdBy ?? "", textContent });
  const workspaceRoot = getWorkspaceRoot();
  const artifactRelPath = path.join(
    "data",
    "exports",
    "processing",
    "human",
    HUMAN_PROCESSOR_VERSION,
    String(fileBinaryId),
    variantKey,
  ).replace(/\\/gu, "/");
  const artifactAbsPath = path.join(workspaceRoot, artifactRelPath);
  await ensureDir(artifactAbsPath);
  await writeText(path.join(artifactAbsPath, "text.txt"), textContent);
  await writeJson(path.join(artifactAbsPath, "summary.json"), {
    processor_key: HUMAN_PROCESSOR_KEY,
    processor_version: HUMAN_PROCESSOR_VERSION,
    created_by: createdBy,
    based_on_representation_id: basedOnRepresentationId,
    selection_note: selectionNote,
    text_length: textContent.length,
  });
  return withTransaction(client, async () => {
    const jobResult = await client.query(
      `
        INSERT INTO casework.processing_job (
          stage_key,
          status,
          file_binary_id,
          processor_key,
          processor_version,
          requested_by,
          requested_at,
          started_at,
          completed_at,
          attempt_count,
          max_attempts
        )
        VALUES ($1, 'completed', $2, $3, $4, $5, NOW(), NOW(), NOW(), 1, 1)
        RETURNING id
      `,
      [
        HUMAN_STAGE_KEY,
        fileBinaryId,
        HUMAN_PROCESSOR_KEY,
        HUMAN_PROCESSOR_VERSION,
        createdBy ?? "human-representation",
      ],
    );
    const representationResult = await client.query(
      `
        INSERT INTO casework.document_representation (
          file_binary_id,
          produced_by_job_id,
          representation_kind,
          format_family,
          processor_key,
          processor_version,
          representation_source_kind,
          representation_variant_key,
          based_on_representation_id,
          metadata_json,
          content_json,
          artifact_rel_path
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'human_authored', $7, $8, $9::jsonb, $10::jsonb, $11)
        RETURNING *
      `,
      [
        fileBinaryId,
        jobResult.rows[0].id,
        representationKind,
        formatFamily,
        HUMAN_PROCESSOR_KEY,
        HUMAN_PROCESSOR_VERSION,
        variantKey,
        basedOnRepresentationId,
        JSON.stringify({
          created_by: createdBy,
          selection_note: selectionNote,
        }),
        JSON.stringify({
          text_length: textContent.length,
        }),
        artifactRelPath,
      ],
    );
    await client.query(
      `
        INSERT INTO casework.document_segment (
          document_representation_id,
          segment_kind,
          sequence_no,
          text_content,
          structural_path,
          page_no,
          char_start,
          char_end,
          metadata_json
        )
        VALUES ($1, 'document_text', 1, $2, NULL, NULL, 0, $3, $4::jsonb)
      `,
      [
        representationResult.rows[0].id,
        textContent,
        textContent.length,
        JSON.stringify({ source: "text.txt", created_by: createdBy }),
      ],
    );
    return representationResult.rows[0];
  });
}

export async function enqueueJobsForBinary(client, binaryRow, options = {}) {
  const {
    requestedBy = "processing-admin",
    registry = undefined,
    processorKeys = null,
  } = options;
  const processors = determineProcessingPolicy(binaryRow, registry)
    .filter((processor) => processorKeys === null || processorKeys.includes(processor.key));
  const results = [];
  for (const processor of processors) {
    const existingRepresentation = await client.query(
      `
        SELECT id
        FROM casework.document_representation
        WHERE file_binary_id = $1
          AND representation_kind = $2
          AND processor_key = $3
          AND processor_version = $4
          AND representation_variant_key = ''
      `,
      [binaryRow.id, processor.representationKind, processor.key, processor.version],
    );
    if (existingRepresentation.rowCount > 0) {
      results.push({
        processor_key: processor.key,
        processor_version: processor.version,
        action: "already_satisfied",
        representation_id: existingRepresentation.rows[0].id,
      });
      continue;
    }
    const existingJob = await client.query(
      `
        SELECT id, status
        FROM casework.processing_job
        WHERE stage_key = $1
          AND file_binary_id = $2
          AND processor_key = $3
          AND processor_version = $4
          AND status IN ('queued', 'running')
      `,
      [EXTRACT_STAGE_KEY, binaryRow.id, processor.key, processor.version],
    );
    if (existingJob.rowCount > 0) {
      results.push({
        processor_key: processor.key,
        processor_version: processor.version,
        action: "already_active",
        processing_job_id: existingJob.rows[0].id,
        status: existingJob.rows[0].status,
      });
      continue;
    }
    const insertResult = await client.query(
      `
        INSERT INTO casework.processing_job (
          stage_key,
          status,
          file_binary_id,
          processor_key,
          processor_version,
          requested_by
        )
        VALUES ($1, 'queued', $2, $3, $4, $5)
        RETURNING id
      `,
      [EXTRACT_STAGE_KEY, binaryRow.id, processor.key, processor.version, requestedBy],
    );
    results.push({
      processor_key: processor.key,
      processor_version: processor.version,
      action: "enqueued",
      processing_job_id: insertResult.rows[0].id,
    });
  }
  return results;
}

export async function claimNextJob(client) {
  return withTransaction(client, async () => {
    const result = await client.query(
      `
        WITH candidate AS (
          SELECT pj.id
          FROM casework.processing_job AS pj
          LEFT JOIN casework.processing_job AS parent
            ON parent.id = pj.depends_on_job_id
          WHERE pj.status = 'queued'
            AND (
              pj.depends_on_job_id IS NULL
              OR parent.status = 'completed'
            )
          ORDER BY pj.requested_at ASC, pj.id ASC
          FOR UPDATE OF pj SKIP LOCKED
          LIMIT 1
        )
        UPDATE casework.processing_job AS pj
        SET
          status = 'running',
          started_at = NOW(),
          attempt_count = pj.attempt_count + 1,
          error_code = NULL,
          error_text = NULL
        FROM candidate
        WHERE pj.id = candidate.id
        RETURNING pj.*
      `,
    );
    return result.rows[0] ?? null;
  });
}

export async function recoverRunningJobs(client, { olderThanMinutes = 30, requestedBy = "processing-admin-recover" } = {}) {
  const result = await client.query(
    `
      UPDATE casework.processing_job
      SET
        status = 'queued',
        error_code = 'worker_recovery',
        error_text = 'Recovered from abandoned running state',
        requested_by = $2,
        completed_at = NULL
      WHERE status = 'running'
        AND started_at < NOW() - make_interval(mins => $1::int)
      RETURNING id
    `,
    [olderThanMinutes, requestedBy],
  );
  return result.rows.map((row) => row.id);
}

export async function markBlockedDependents(client) {
  const result = await client.query(
    `
      UPDATE casework.processing_job AS child
      SET
        status = 'blocked',
        error_code = 'dependency_terminal',
        error_text = 'Dependency cannot complete successfully',
        completed_at = NOW()
      FROM casework.processing_job AS parent
      WHERE child.depends_on_job_id = parent.id
        AND child.status = 'queued'
        AND parent.status IN ('failed', 'cancelled', 'blocked')
      RETURNING child.id
    `,
  );
  return result.rows.map((row) => row.id);
}

async function insertRepresentationArtifacts(client, jobRow, executionResult) {
  const representationResult = await client.query(
    `
      INSERT INTO casework.document_representation (
        file_binary_id,
        produced_by_job_id,
        representation_kind,
        format_family,
        processor_key,
        processor_version,
        representation_source_kind,
        representation_variant_key,
        based_on_representation_id,
        metadata_json,
        content_json,
        artifact_rel_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'machine_generated', '', NULL, $7::jsonb, $8::jsonb, $9)
      ON CONFLICT (file_binary_id, representation_kind, processor_key, processor_version, representation_variant_key)
      DO NOTHING
      RETURNING *
    `,
    [
      jobRow.file_binary_id,
      jobRow.id,
      executionResult.representationKind,
      executionResult.formatFamily,
      executionResult.processorKey,
      executionResult.processorVersion,
      JSON.stringify(executionResult.metadataJson ?? {}),
      executionResult.contentJson ? JSON.stringify(executionResult.contentJson) : null,
      executionResult.artifactRelPath,
    ],
  );
  if (representationResult.rowCount === 0) {
    const existing = await client.query(
      `
        SELECT *
        FROM casework.document_representation
        WHERE file_binary_id = $1
          AND representation_kind = $2
          AND processor_key = $3
          AND processor_version = $4
          AND representation_variant_key = ''
      `,
      [
        jobRow.file_binary_id,
        executionResult.representationKind,
        executionResult.processorKey,
        executionResult.processorVersion,
      ],
    );
    return { representation: existing.rows[0], inserted: false };
  }
  const representation = representationResult.rows[0];
  for (const segment of executionResult.segments ?? []) {
    await client.query(
      `
        INSERT INTO casework.document_segment (
          document_representation_id,
          segment_kind,
          sequence_no,
          text_content,
          structural_path,
          page_no,
          char_start,
          char_end,
          metadata_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        representation.id,
        segment.segment_kind,
        segment.sequence_no,
        segment.text_content,
        segment.structural_path,
        segment.page_no,
        segment.char_start,
        segment.char_end,
        JSON.stringify(segment.metadata_json ?? {}),
      ],
    );
  }
  return { representation, inserted: true };
}

async function ensureComparisonsForRepresentation(client, representation) {
  const others = await client.query(
    `
      SELECT id, processor_key
      FROM casework.document_representation
      WHERE file_binary_id = $1
        AND representation_kind = $2
        AND id <> $3
      ORDER BY id ASC
    `,
    [representation.file_binary_id, representation.representation_kind, representation.id],
  );
  const currentText = await getRepresentationText(client, representation.id);
  for (const other of others.rows) {
    const [leftId, rightId] = canonicalizeComparisonPair(representation.id, other.id);
    const existing = await client.query(
      `
        SELECT id
        FROM casework.document_representation_comparison
        WHERE file_binary_id = $1
          AND comparison_kind = $2
          AND comparator_key = $3
          AND comparator_version = $4
          AND representation_a_id = $5
          AND representation_b_id = $6
      `,
      [
        representation.file_binary_id,
        DEFAULT_COMPARISON_KIND,
        COMPARATOR_KEY,
        COMPARATOR_VERSION,
        leftId,
        rightId,
      ],
    );
    if (existing.rowCount > 0) {
      continue;
    }
    const otherText = await getRepresentationText(client, other.id);
    const leftText = leftId === representation.id ? currentText : otherText;
    const rightText = rightId === representation.id ? currentText : otherText;
    const observation = buildComparisonObservation({
      leftLabel: leftId === representation.id ? representation.processor_key : other.processor_key,
      rightLabel: rightId === representation.id ? representation.processor_key : other.processor_key,
      leftText,
      rightText,
    });
    await client.query(
      `
        INSERT INTO casework.document_representation_comparison (
          file_binary_id,
          representation_a_id,
          representation_b_id,
          comparison_kind,
          comparator_key,
          comparator_version,
          summary_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        representation.file_binary_id,
        leftId,
        rightId,
        DEFAULT_COMPARISON_KIND,
        COMPARATOR_KEY,
        COMPARATOR_VERSION,
        JSON.stringify(observation),
      ],
    );
  }
}

export async function markJobCompleted(client, jobRow, executionResult) {
  return withTransaction(client, async () => {
    const { representation } = await insertRepresentationArtifacts(client, jobRow, executionResult);
    await ensureComparisonsForRepresentation(client, representation);
    await client.query(
      `
        UPDATE casework.processing_job
        SET
          status = 'completed',
          completed_at = NOW()
        WHERE id = $1
      `,
      [jobRow.id],
    );
    return representation;
  });
}

export async function markJobFailure(client, jobRow, { errorCode, errorText }) {
  const nextStatus = jobRow.attempt_count >= jobRow.max_attempts ? "failed" : "queued";
  const completedAtClause = nextStatus === "failed" ? "NOW()" : "NULL";
  await client.query(
    `
      UPDATE casework.processing_job
      SET
        status = $2,
        error_code = $3,
        error_text = LEFT($4, 8000),
        completed_at = ${completedAtClause}
      WHERE id = $1
    `,
    [jobRow.id, nextStatus, errorCode, errorText],
  );
}

export async function countProcessingState(client) {
  const result = await client.query(
    `
      SELECT
        (SELECT COUNT(*) FROM casework.processing_job) AS processing_job_count,
        (SELECT COUNT(*) FROM casework.document_representation) AS representation_count,
        (SELECT COUNT(*) FROM casework.document_segment) AS segment_count,
        (SELECT COUNT(*) FROM casework.document_representation_selection) AS selection_count,
        (SELECT COUNT(*) FROM casework.document_representation_comparison) AS comparison_count
    `,
  );
  return result.rows[0];
}

export async function inspectJobs(client) {
  const result = await client.query(
    `
      SELECT
        id,
        stage_key,
        status,
        file_binary_id,
        document_representation_id,
        processor_key,
        processor_version,
        requested_by,
        requested_at,
        started_at,
        completed_at,
        attempt_count,
        max_attempts,
        error_code
      FROM casework.processing_job
      ORDER BY requested_at ASC, id ASC
    `,
  );
  return result.rows;
}

export async function inspectRepresentationState(client, fileBinaryId) {
  const binaryRow = await getBinaryRowById(client, fileBinaryId);
  const representations = await listRepresentationsForBinary(client, fileBinaryId);
  const comparisons = await listComparisonsForBinary(client, fileBinaryId);
  const selection = await resolveEffectiveRepresentation(client, { fileBinaryId });
  const attention = await deriveRepresentationAttention(client, fileBinaryId);
  return {
    binary: binaryRow,
    representations,
    comparisons,
    effective_selection: selection,
    attention,
  };
}

export async function processOneJob(client, {
  registry = undefined,
  workspaceRoot = getWorkspaceRoot(),
  afterClaim = null,
  beforePersist = null,
}) {
  await markBlockedDependents(client);
  const jobRow = await claimNextJob(client);
  if (!jobRow) {
    return null;
  }
  if (typeof afterClaim === "function") {
    await afterClaim(jobRow);
  }
  try {
    if (jobRow.file_binary_id === null) {
      throw new Error(`Unsupported processing target for job ${jobRow.id}`);
    }
    const binaryRow = await getBinaryRowById(client, jobRow.file_binary_id);
    const processor = getProcessor(jobRow.processor_key, registry);
    const tempArtifactDir = await makeTempDir(`virgilio-${slugForJob(jobRow)}-`);
    try {
      const executionResult = await processor.execute({
        workspaceRoot,
        binaryRow,
        tempArtifactDir,
        outputRoot: getProcessingOutputRoot(workspaceRoot),
        jobRow,
      });
      if (typeof beforePersist === "function") {
        await beforePersist(jobRow, executionResult);
      }
      const representation = await markJobCompleted(client, jobRow, executionResult);
      return {
        job: jobRow,
        representation,
        status: "completed",
      };
    } finally {
      await fs.rm(tempArtifactDir, { recursive: true, force: true });
    }
  } catch (error) {
    await markJobFailure(client, jobRow, {
      errorCode: "processor_failed",
      errorText: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    return {
      job: jobRow,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function slugForJob(jobRow) {
  const target = jobRow.file_binary_id !== null ? `fb-${jobRow.file_binary_id}` : `dr-${jobRow.document_representation_id}`;
  return `${jobRow.processor_key}-${target}-${jobRow.id}`
    .replace(/[^a-z0-9-]+/giu, "-")
    .toLowerCase();
}

export async function runWorkerLoop(client, {
  registry = undefined,
  workspaceRoot = getWorkspaceRoot(),
  once = false,
  pollMs = 2000,
  maxJobs = null,
  afterClaim = null,
  beforePersist = null,
}) {
  const processed = [];
  let remaining = maxJobs;
  while (remaining === null || remaining > 0) {
    const result = await processOneJob(client, {
      registry,
      workspaceRoot,
      afterClaim,
      beforePersist,
    });
    if (!result) {
      if (once || processed.length > 0) {
        break;
      }
      await sleep(pollMs);
      continue;
    }
    processed.push(result);
    if (remaining !== null) {
      remaining -= 1;
    }
    if (once) {
      break;
    }
  }
  return processed;
}
