import fs from "node:fs/promises";
import path from "node:path";

import { LocalBinaryStore } from "./binary-store.mjs";
import {
  DEFAULT_SELECTION_PURPOSE,
  getWorkspaceRoot,
  sha256File,
} from "./processing-common.mjs";
import {
  listComparisonsForBinary,
  listRepresentationsForBinary,
  resolveEffectiveRepresentation,
} from "./processing-store.mjs";
import {
  listRepresentationArtifactFiles,
  resolveRepresentationArtifactDir,
} from "./representation-artifacts.mjs";

export const PORTABLE_EXPORT_PACKAGE_FORMAT = "virgilio-portable-evidence";
export const PORTABLE_EXPORT_PACKAGE_VERSION = 1;

async function getExportBinaryRowBySha(client, sha256) {
  const result = await client.query(
    `
      SELECT *
      FROM casework.file_binary
      WHERE sha256 = $1
    `,
    [sha256],
  );
  if (result.rowCount !== 1) {
    const error = new Error(`Unknown file_binary sha256: ${sha256}`);
    error.code = "NOT_FOUND";
    throw error;
  }
  return result.rows[0];
}

function stableSortRows(rows, keys) {
  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const leftValue = left[key];
      const rightValue = right[key];
      if (leftValue === rightValue) {
        continue;
      }
      if (leftValue === null || leftValue === undefined) {
        return -1;
      }
      if (rightValue === null || rightValue === undefined) {
        return 1;
      }
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return leftValue - rightValue;
      }
      return String(leftValue).localeCompare(String(rightValue), "en");
    }
    return 0;
  });
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

async function ensureTargetDirDoesNotExist(outputDir) {
  try {
    await fs.access(outputDir);
    throw new Error(`Output directory already exists: ${outputDir}`);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function copyFileAndHash(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
  const stats = await fs.stat(targetPath);
  return {
    sizeBytes: Number(stats.size),
    sha256: await sha256File(targetPath),
  };
}

async function copyDirectoryRecursive(sourceDir, targetDir, rootTargetDir = targetDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name, "en"));
  const copiedFiles = [];
  for (const entry of sorted) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copiedFiles.push(...(await copyDirectoryRecursive(sourcePath, targetPath, rootTargetDir)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const copied = await copyFileAndHash(sourcePath, targetPath);
    copiedFiles.push({
      relativePath: path.relative(rootTargetDir, targetPath).replace(/\\/gu, "/"),
      sizeBytes: copied.sizeBytes,
      sha256: copied.sha256,
    });
  }
  return copiedFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
}

async function listDocumentBinaryRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT
        id,
        document_id,
        file_binary_id,
        source_observation_count,
        is_primary,
        match_confidence,
        created_at,
        updated_at
      FROM casework.document_binary
      WHERE file_binary_id = $1
      ORDER BY is_primary DESC, id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listDocumentRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        d.id,
        d.source_system,
        d.document_procinfo,
        d.document_name,
        d.document_anchor_title,
        d.document_date,
        d.document_type,
        d.document_type_from_attr,
        d.claimed_size_bytes,
        d.canonical_confidence,
        d.created_at,
        d.updated_at,
        d.document_identity_class
      FROM casework.document_binary AS db
      JOIN casework.document AS d
        ON d.id = db.document_id
      WHERE db.file_binary_id = $1
      ORDER BY d.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listBucketDocumentRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        bd.id,
        bd.bucket_id,
        bd.document_id,
        bd.source_observation_count,
        bd.has_intra_bucket_duplication,
        bd.canonical_confidence,
        bd.created_at,
        bd.updated_at
      FROM casework.document_binary AS db
      JOIN casework.bucket_document AS bd
        ON bd.document_id = db.document_id
      WHERE db.file_binary_id = $1
      ORDER BY bd.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listBucketRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        b.id,
        b.case_file_id,
        b.source_system,
        b.bucket_id,
        b.reference_number,
        b.bucket_date,
        b.designation,
        b.presenter,
        b.modal_title,
        b.document_count,
        b.displayed_bucket_size_bytes,
        b.canonical_confidence,
        b.created_at,
        b.updated_at
      FROM casework.document_binary AS db
      JOIN casework.bucket_document AS bd
        ON bd.document_id = db.document_id
      JOIN casework.bucket AS b
        ON b.id = bd.bucket_id
      WHERE db.file_binary_id = $1
      ORDER BY b.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listCaseRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        cf.id,
        cf.court_id,
        cf.source_system,
        cf.processo,
        cf.idprocesso,
        cf.especie,
        cf.estado,
        cf.data_autuacao,
        cf.data_decisao,
        cf.parent_case_file_id,
        cf.is_base_case,
        cf.case_scope_status,
        cf.canonical_confidence,
        cf.created_at,
        cf.updated_at,
        cf.case_workspace_id
      FROM casework.document_binary AS db
      JOIN casework.bucket_document AS bd
        ON bd.document_id = db.document_id
      JOIN casework.bucket AS b
        ON b.id = bd.bucket_id
      JOIN casework.case_file AS cf
        ON cf.id = b.case_file_id
      WHERE db.file_binary_id = $1
      ORDER BY cf.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listWorkspaceRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        cw.id,
        cw.workspace_code,
        cw.title,
        cw.description,
        cw.lifecycle_status,
        cw.primary_country_id,
        cw.opened_at,
        cw.closed_at,
        cw.created_by,
        cw.created_at,
        cw.updated_at
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
      ORDER BY cw.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listWorkspaceDocumentRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        cwd.id,
        cwd.case_workspace_id,
        cwd.document_id,
        cwd.created_at,
        cwd.updated_at
      FROM casework.document_binary AS db
      JOIN casework.case_workspace_document AS cwd
        ON cwd.document_id = db.document_id
      WHERE db.file_binary_id = $1
      ORDER BY cwd.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listDocumentOriginRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT DISTINCT
        dor.id,
        dor.case_workspace_document_id,
        dor.origin_kind,
        dor.origin_reference,
        dor.origin_label,
        dor.origin_at,
        dor.actor_name,
        dor.created_by,
        dor.note_text,
        dor.metadata_json,
        dor.created_at,
        dor.updated_at
      FROM casework.document_binary AS db
      JOIN casework.case_workspace_document AS cwd
        ON cwd.document_id = db.document_id
      JOIN casework.document_origin AS dor
        ON dor.case_workspace_document_id = cwd.id
      WHERE db.file_binary_id = $1
      ORDER BY dor.id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function getImportBatchRow(client, packageId) {
  if (!packageId) {
    return null;
  }
  const result = await client.query(
    `
      SELECT *
      FROM casework.import_batch
      WHERE package_id = $1
    `,
    [packageId],
  );
  return result.rows[0] ?? null;
}

async function listProcessingJobsForBinary(client, fileBinaryId) {
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
        error_code,
        error_text,
        depends_on_job_id
      FROM casework.processing_job
      WHERE file_binary_id = $1
      ORDER BY requested_at ASC, id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listSelectionRows(client, fileBinaryId) {
  const result = await client.query(
    `
      SELECT *
      FROM casework.document_representation_selection
      WHERE file_binary_id = $1
      ORDER BY selection_purpose ASC, id ASC
    `,
    [fileBinaryId],
  );
  return result.rows;
}

async function listSegmentRows(client, representationIds) {
  if (representationIds.length === 0) {
    return [];
  }
  const result = await client.query(
    `
      SELECT
        id,
        document_representation_id,
        segment_kind,
        sequence_no,
        text_content,
        structural_path,
        page_no,
        char_start,
        char_end,
        metadata_json,
        created_at
      FROM casework.document_segment
      WHERE document_representation_id = ANY($1::bigint[])
      ORDER BY document_representation_id ASC, sequence_no ASC, id ASC
    `,
    [representationIds],
  );
  return result.rows;
}

function buildDerivedEffectiveSelection(effectiveSelection) {
  return {
    selection_purpose: effectiveSelection.purpose ?? DEFAULT_SELECTION_PURPOSE,
    selection_source: effectiveSelection.selection_source,
    selected_representation_id: effectiveSelection.representation?.id ?? null,
    selected_processor_key: effectiveSelection.representation?.processor_key ?? null,
    selected_processor_version: effectiveSelection.representation?.processor_version ?? null,
    explicit_selection_id: effectiveSelection.explicit_selection?.id ?? null,
  };
}

export async function loadPortableBinaryExportState(client, { sha256 }) {
  const binaryRow = await getExportBinaryRowBySha(client, sha256);
  const documentBinaries = await listDocumentBinaryRows(client, binaryRow.id);
  const documents = await listDocumentRows(client, binaryRow.id);
  const bucketDocuments = await listBucketDocumentRows(client, binaryRow.id);
  const buckets = await listBucketRows(client, binaryRow.id);
  const cases = await listCaseRows(client, binaryRow.id);
  const workspaces = await listWorkspaceRows(client, binaryRow.id);
  const workspaceDocuments = await listWorkspaceDocumentRows(client, binaryRow.id);
  const documentOrigins = await listDocumentOriginRows(client, binaryRow.id);
  const processingJobs = await listProcessingJobsForBinary(client, binaryRow.id);
  const representations = await listRepresentationsForBinary(client, binaryRow.id);
  const selectionRows = await listSelectionRows(client, binaryRow.id);
  const comparisons = await listComparisonsForBinary(client, binaryRow.id);
  const effectiveSelection = await resolveEffectiveRepresentation(client, { fileBinaryId: binaryRow.id });
  const importBatch = await getImportBatchRow(client, binaryRow.storage_package_id);
  const representationIds = representations.map((representation) => representation.id);
  const segmentRows = await listSegmentRows(client, representationIds);
  const segmentsByRepresentationId = new Map();
  for (const row of segmentRows) {
    const list = segmentsByRepresentationId.get(row.document_representation_id) ?? [];
    list.push(row);
    segmentsByRepresentationId.set(row.document_representation_id, list);
  }
  const representationByProducedJobId = new Map(
    representations.map((representation) => [representation.produced_by_job_id, representation.id]),
  );
  return {
    binary: binaryRow,
    importBatch,
    context: {
      documentBinaries,
      documents,
      bucketDocuments,
      buckets,
      cases,
      workspaces,
      workspaceDocuments,
      documentOrigins,
    },
    processing: {
      jobs: processingJobs.map((job) => ({
        ...job,
        produced_representation_id: representationByProducedJobId.get(job.id) ?? null,
      })),
      selectionRows,
      derivedEffectiveSelection: buildDerivedEffectiveSelection(effectiveSelection),
      comparisons,
    },
    representations: representations.map((representation) => ({
      ...representation,
      segments: segmentsByRepresentationId.get(representation.id) ?? [],
    })),
  };
}

function buildOriginalBinaryPath(binary) {
  const extension = binary.file_extension || "";
  return path.join("originals", `${binary.sha256}${extension}`).replace(/\\/gu, "/");
}

function buildRepresentationArtifactPackageDir(representation) {
  return path.join("representations", String(representation.id), "artifacts").replace(/\\/gu, "/");
}

function sanitizeBinaryForManifest(binary) {
  return {
    id: toNumberOrNull(binary.id),
    sha256: binary.sha256,
    actual_size_bytes: toNumberOrNull(binary.actual_size_bytes),
    mime_type: binary.mime_type,
    file_extension: binary.file_extension,
    retention_status: binary.retention_status ?? null,
    integrity_check_status: binary.integrity_check_status ?? null,
    integrity_checked_at: binary.integrity_checked_at ?? null,
    integrity_checker: binary.integrity_checker ?? null,
    machine_readability_status: binary.machine_readability_status ?? null,
    machine_readability_checked_at: binary.machine_readability_checked_at ?? null,
    page_count: toNumberOrNull(binary.page_count),
    pages_with_text: toNumberOrNull(binary.pages_with_text),
    pages_without_text: toNumberOrNull(binary.pages_without_text),
    text_coverage_ratio: binary.text_coverage_ratio === null || binary.text_coverage_ratio === undefined
      ? null
      : Number(binary.text_coverage_ratio),
    total_extracted_characters: toNumberOrNull(binary.total_extracted_characters),
    page_text_report_json: binary.page_text_report_json ?? null,
    canonical_confidence: binary.canonical_confidence ?? null,
    created_at: binary.created_at ?? null,
    updated_at: binary.updated_at ?? null,
    source_storage: {
      storage_package_id: binary.storage_package_id,
      storage_rel_path: binary.storage_rel_path,
    },
  };
}

function sanitizeImportBatchForManifest(importBatch) {
  if (!importBatch) {
    return null;
  }
  return {
    ...importBatch,
    id: toNumberOrNull(importBatch.id),
    case_count: toNumberOrNull(importBatch.case_count),
    document_count: toNumberOrNull(importBatch.document_count),
    file_binary_count: toNumberOrNull(importBatch.file_binary_count),
    source_capture_id: toNumberOrNull(importBatch.source_capture_id),
  };
}

function sanitizeRepresentationForManifest(representation) {
  return {
    id: toNumberOrNull(representation.id),
    file_binary_id: toNumberOrNull(representation.file_binary_id),
    produced_by_job_id: toNumberOrNull(representation.produced_by_job_id),
    representation_kind: representation.representation_kind,
    format_family: representation.format_family,
    processor_key: representation.processor_key,
    processor_version: representation.processor_version,
    representation_source_kind: representation.representation_source_kind,
    representation_variant_key: representation.representation_variant_key,
    based_on_representation_id: toNumberOrNull(representation.based_on_representation_id),
    metadata_json: representation.metadata_json ?? {},
    content_json: representation.content_json ?? null,
    artifact_rel_path: representation.artifact_rel_path ?? null,
    created_at: representation.created_at,
    segment_count: Number(representation.segment_count ?? representation.segments.length ?? 0),
    segments: representation.segments.map((segment) => ({
      id: segment.id,
      segment_kind: segment.segment_kind,
      sequence_no: Number(segment.sequence_no),
      text_content: segment.text_content,
      structural_path: segment.structural_path,
      page_no: toNumberOrNull(segment.page_no),
      char_start: toNumberOrNull(segment.char_start),
      char_end: toNumberOrNull(segment.char_end),
      metadata_json: segment.metadata_json ?? {},
      created_at: segment.created_at,
    })),
  };
}

function sanitizeRows(rows, numericKeys = []) {
  return rows.map((row) => {
    const copy = { ...row };
    for (const key of numericKeys) {
      copy[key] = toNumberOrNull(copy[key]);
    }
    return copy;
  });
}

function sanitizeDerivedEffectiveSelection(effectiveSelection) {
  return {
    selection_purpose: effectiveSelection.selection_purpose,
    selection_source: effectiveSelection.selection_source,
    selected_representation_id: toNumberOrNull(effectiveSelection.selected_representation_id),
    selected_processor_key: effectiveSelection.selected_processor_key,
    selected_processor_version: effectiveSelection.selected_processor_version,
    explicit_selection_id: toNumberOrNull(effectiveSelection.explicit_selection_id),
  };
}

async function copyRepresentationArtifacts(workspaceRoot, representation, outputDir) {
  if (!representation.artifact_rel_path) {
    return null;
  }
  const sourceDir = resolveRepresentationArtifactDir(workspaceRoot, representation);
  const sourceFiles = await listRepresentationArtifactFiles(workspaceRoot, representation);
  const packageDirRelPath = buildRepresentationArtifactPackageDir(representation);
  const packageDirAbsPath = path.join(outputDir, packageDirRelPath);
  const copiedFiles = await copyDirectoryRecursive(sourceDir, packageDirAbsPath);
  return {
    representation_id: toNumberOrNull(representation.id),
    source_artifact_rel_path: representation.artifact_rel_path,
    package_dir: packageDirRelPath,
    source_files: sourceFiles,
    copied_files: copiedFiles,
  };
}

export async function writePortableBinaryExportPackage(state, {
  outputDir,
  workspaceRoot = getWorkspaceRoot(),
  binaryStore = null,
}) {
  await ensureTargetDirDoesNotExist(outputDir);
  await fs.mkdir(outputDir, { recursive: true });
  try {
    const resolvedBinaryStore = binaryStore ?? new LocalBinaryStore({ workspaceRoot });
    const materializedBinary = await resolvedBinaryStore.materialize(state.binary);
    const originalRelativePath = buildOriginalBinaryPath(state.binary);
    let originalBinaryInfo;
    try {
      originalBinaryInfo = await copyFileAndHash(
        materializedBinary.localPath,
        path.join(outputDir, originalRelativePath),
      );
    } finally {
      await materializedBinary.release();
    }
    if (originalBinaryInfo.sha256 !== state.binary.sha256) {
      throw new Error(`Exported original binary SHA-256 mismatch for file_binary ${state.binary.id}`);
    }
    if (
      state.binary.actual_size_bytes !== null
      && state.binary.actual_size_bytes !== undefined
      && Number(state.binary.actual_size_bytes) !== originalBinaryInfo.sizeBytes
    ) {
      throw new Error(`Exported original binary size mismatch for file_binary ${state.binary.id}`);
    }

    const representations = stableSortRows(state.representations, ["created_at", "id"]);
    const copiedArtifacts = [];
    for (const representation of representations) {
      const copied = await copyRepresentationArtifacts(workspaceRoot, representation, outputDir);
      if (copied) {
        copiedArtifacts.push(copied);
      }
    }

    const manifest = {
      package_format: PORTABLE_EXPORT_PACKAGE_FORMAT,
      package_version: PORTABLE_EXPORT_PACKAGE_VERSION,
      exported_at: new Date().toISOString(),
      persisted: {
        file_binary: sanitizeBinaryForManifest(state.binary),
        import_batch: sanitizeImportBatchForManifest(state.importBatch),
        document_binaries: sanitizeRows(
          stableSortRows(state.context.documentBinaries, ["id"]),
          ["id", "document_id", "file_binary_id", "source_observation_count"],
        ),
        documents: sanitizeRows(
          stableSortRows(state.context.documents, ["id"]),
          ["id", "claimed_size_bytes"],
        ),
        bucket_documents: sanitizeRows(
          stableSortRows(state.context.bucketDocuments, ["id"]),
          ["id", "bucket_id", "document_id", "source_observation_count"],
        ),
        buckets: sanitizeRows(
          stableSortRows(state.context.buckets, ["id"]),
          ["id", "case_file_id", "document_count", "displayed_bucket_size_bytes"],
        ),
        case_files: sanitizeRows(
          stableSortRows(state.context.cases, ["id"]),
          ["id", "court_id", "parent_case_file_id", "case_workspace_id"],
        ),
        case_workspaces: sanitizeRows(
          stableSortRows(state.context.workspaces, ["id"]),
          ["id"],
        ),
        case_workspace_documents: sanitizeRows(
          stableSortRows(state.context.workspaceDocuments, ["id"]),
          ["id", "case_workspace_id", "document_id"],
        ),
        document_origins: sanitizeRows(
          stableSortRows(state.context.documentOrigins, ["id"]),
          ["id", "case_workspace_document_id"],
        ),
        processing_jobs: sanitizeRows(
          stableSortRows(state.processing.jobs, ["requested_at", "id"]),
          [
            "id",
            "file_binary_id",
            "document_representation_id",
            "attempt_count",
            "max_attempts",
            "depends_on_job_id",
            "produced_representation_id",
          ],
        ),
        document_representation_selections: sanitizeRows(
          stableSortRows(state.processing.selectionRows, ["selection_purpose", "id"]),
          ["id", "file_binary_id", "selected_representation_id"],
        ),
        document_representation_comparisons: sanitizeRows(
          stableSortRows(state.processing.comparisons, ["id"]),
          ["id", "file_binary_id", "representation_a_id", "representation_b_id"],
        ),
        document_representations: representations.map((representation) => sanitizeRepresentationForManifest(
          representation,
        )),
      },
      package_contents: {
        original_binary: {
          package_path: originalRelativePath,
          size_bytes: originalBinaryInfo.sizeBytes,
          sha256: originalBinaryInfo.sha256,
        },
        representation_artifacts: copiedArtifacts,
      },
      derived: {
        effective_selection: sanitizeDerivedEffectiveSelection(state.processing.derivedEffectiveSelection),
      },
    };

    await fs.writeFile(
      path.join(outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    return {
      outputDir,
      manifest,
    };
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}

export async function exportPortableBinaryPackage(client, {
  sha256,
  outputDir,
  workspaceRoot = getWorkspaceRoot(),
  binaryStore = null,
}) {
  const state = await loadPortableBinaryExportState(client, { sha256 });
  return writePortableBinaryExportPackage(state, {
    outputDir,
    workspaceRoot,
    binaryStore,
  });
}
