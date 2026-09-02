import fs from "node:fs/promises";
import path from "node:path";

import {
  FACTUAL_EXPORT_PACKAGE_FORMAT,
  FACTUAL_EXPORT_PACKAGE_VERSION,
} from "./factual-export-contract.mjs";
import { exportPortableBinaryPackage } from "./portable-export.mjs";
import { getWorkspaceRoot, sha256File } from "./processing-common.mjs";

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(columns, rows) {
  return `${[
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
  ].join("\n")}\n`;
}

async function assertNewDirectory(outputDir) {
  try {
    await fs.access(outputDir);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Output directory already exists: ${outputDir}`);
}

async function writeText(outputDir, relativePath, content) {
  const target = path.join(outputDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  const stats = await fs.stat(target);
  return {
    path: relativePath.replace(/\\/gu, "/"),
    size_bytes: Number(stats.size),
    sha256: await sha256File(target),
  };
}

function buildContextRows(sha256, manifest) {
  const persisted = manifest.persisted;
  const documents = new Map(persisted.documents.map((row) => [row.id, row]));
  const buckets = new Map(persisted.buckets.map((row) => [row.id, row]));
  const cases = new Map(persisted.case_files.map((row) => [row.id, row]));
  const bucketDocuments = new Map();
  for (const row of persisted.bucket_documents) {
    const items = bucketDocuments.get(row.document_id) ?? [];
    items.push(row);
    bucketDocuments.set(row.document_id, items);
  }
  return persisted.document_binaries.flatMap((link) => {
    const document = documents.get(link.document_id) ?? {};
    const memberships = bucketDocuments.get(link.document_id) ?? [null];
    return memberships.map((membership) => {
      const bucket = membership ? buckets.get(membership.bucket_id) ?? {} : {};
      const caseFile = bucket.case_file_id ? cases.get(bucket.case_file_id) ?? {} : {};
      return {
        sha256,
        document_binary_id: link.id,
        is_primary: link.is_primary,
        document_id: document.id,
        source_system: document.source_system,
        document_procinfo: document.document_procinfo,
        document_name: document.document_name,
        document_date: document.document_date,
        document_type: document.document_type,
        bucket_row_id: bucket.id,
        source_bucket_id: bucket.bucket_id,
        bucket_date: bucket.bucket_date,
        case_file_id: caseFile.id,
        process_number: caseFile.processo,
      };
    });
  });
}

function buildProcessingRows(sha256, manifest) {
  const persisted = manifest.persisted;
  const artifactByRepresentation = new Map(
    manifest.package_contents.representation_artifacts.map((row) => [row.representation_id, row]),
  );
  const representationRows = persisted.document_representations.map((representation) => ({
    sha256,
    row_kind: "representation",
    processor_key: representation.processor_key,
    processor_version: representation.processor_version,
    representation_id: representation.id,
    representation_kind: representation.representation_kind,
    producing_job_id: representation.produced_by_job_id,
    job_status: "completed",
    error_code: "",
    artifact_directory: artifactByRepresentation.get(representation.id)?.package_dir ?? "",
  }));
  const representedJobIds = new Set(
    persisted.document_representations.map((representation) => representation.produced_by_job_id),
  );
  const nonRepresentationJobs = persisted.processing_jobs
    .filter((job) => !representedJobIds.has(job.id))
    .map((job) => ({
      sha256,
      row_kind: "job_without_representation",
      processor_key: job.processor_key,
      processor_version: job.processor_version,
      representation_id: "",
      representation_kind: "",
      producing_job_id: job.id,
      job_status: job.status,
      error_code: job.error_code ?? "",
      artifact_directory: "",
    }));
  return [...representationRows, ...nonRepresentationJobs];
}

const README = `# Virgilio factual export

This is an immutable, local, multi-binary factual snapshot prepared for file-based consultation.

- Original binaries remain the canonical evidence objects.
- Each binary directory contains a verified portable evidence package.
- Processor outputs remain separate and attributable; this package does not select or merge them.
- Evidence processors make narrow tool-specific observations, not universal truth claims.
- Interpretation processors may normalize, reorder, classify, or omit material for readability.
- Historical processing failures remain present alongside later successes.
- Paths are package-relative. No Google account, permission, or upload state is included.

Start with \`binary-index.csv\`, then use \`document-context-index.csv\` and
\`processing-index.csv\`. The complete persisted records and raw artifacts are
inside \`binaries/<sha256>/\`.
`;

export async function exportFactualSlice(client, {
  sha256s,
  outputDir,
  workspaceRoot = getWorkspaceRoot(),
  requestedScope = "explicit_binary_selection",
}) {
  const normalizedShas = [...new Set(sha256s.map((value) => String(value).trim().toLowerCase()))].sort();
  if (normalizedShas.length === 0 || normalizedShas.some((value) => !/^[a-f0-9]{64}$/u.test(value))) {
    throw new Error("Provide at least one valid SHA-256 value");
  }
  await assertNewDirectory(outputDir);
  await fs.mkdir(outputDir, { recursive: true });
  try {
    const binaryRows = [];
    const contextRows = [];
    const processingRows = [];
    const binaries = [];
    for (const sha256 of normalizedShas) {
      const relativeDir = path.posix.join("binaries", sha256);
      const result = await exportPortableBinaryPackage(client, {
        sha256,
        outputDir: path.join(outputDir, ...relativeDir.split("/")),
        workspaceRoot,
      });
      const manifest = result.manifest;
      const binary = manifest.persisted.file_binary;
      binaryRows.push({
        sha256,
        mime_type: binary.mime_type,
        file_extension: binary.file_extension,
        size_bytes: binary.actual_size_bytes,
        page_count: binary.page_count,
        machine_readability_status: binary.machine_readability_status,
        document_count: manifest.persisted.documents.length,
        representation_count: manifest.persisted.document_representations.length,
        processing_job_count: manifest.persisted.processing_jobs.length,
        package_directory: relativeDir,
      });
      contextRows.push(...buildContextRows(sha256, manifest));
      processingRows.push(...buildProcessingRows(sha256, manifest));
      const childManifestPath = path.join(outputDir, ...relativeDir.split("/"), "manifest.json");
      binaries.push({
        sha256,
        package_directory: relativeDir,
        portable_manifest_path: path.posix.join(relativeDir, "manifest.json"),
        portable_manifest_sha256: await sha256File(childManifestPath),
        original_sha256: manifest.package_contents.original_binary.sha256,
        representation_count: manifest.persisted.document_representations.length,
        processing_job_count: manifest.persisted.processing_jobs.length,
      });
    }

    const generatedFiles = [];
    generatedFiles.push(await writeText(outputDir, "README.md", README));
    generatedFiles.push(await writeText(outputDir, "binary-index.csv", toCsv([
      "sha256", "mime_type", "file_extension", "size_bytes", "page_count",
      "machine_readability_status", "document_count", "representation_count",
      "processing_job_count", "package_directory",
    ], binaryRows)));
    generatedFiles.push(await writeText(outputDir, "document-context-index.csv", toCsv([
      "sha256", "document_binary_id", "is_primary", "document_id", "source_system",
      "document_procinfo", "document_name", "document_date", "document_type",
      "bucket_row_id", "source_bucket_id", "bucket_date", "case_file_id", "process_number",
    ], contextRows)));
    generatedFiles.push(await writeText(outputDir, "processing-index.csv", toCsv([
      "sha256", "row_kind", "processor_key", "processor_version", "representation_id",
      "representation_kind", "producing_job_id", "job_status", "error_code", "artifact_directory",
    ], processingRows)));

    const manifest = {
      package_format: FACTUAL_EXPORT_PACKAGE_FORMAT,
      package_version: FACTUAL_EXPORT_PACKAGE_VERSION,
      exported_at: new Date().toISOString(),
      scope: {
        kind: requestedScope,
        sha256s: normalizedShas,
      },
      counts: {
        binaries: binaries.length,
        document_context_rows: contextRows.length,
        processing_index_rows: processingRows.length,
      },
      generated_files: generatedFiles,
      binaries,
    };
    await writeText(outputDir, "manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
    return { outputDir, manifest };
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}
