import fs from "node:fs/promises";
import path from "node:path";

import {
  PORTABLE_EXPORT_PACKAGE_FORMAT,
  PORTABLE_EXPORT_PACKAGE_VERSION,
} from "./portable-export-contract.mjs";
import { readJson, sha256File } from "./processing-common.mjs";

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) {
    throw fail("invalid_manifest", `Expected ${label} to be an object`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw fail("invalid_manifest", `Expected ${label} to be an array`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw fail("invalid_manifest", `Expected ${label} to be a non-empty string`);
  }
  return value;
}

function requireOptionalFiniteNumber(value, label) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw fail("invalid_manifest", `Expected ${label} to be a finite number or null`);
  }
  return value;
}

function assertSupportedPackageContract(manifest) {
  if (manifest.package_format !== PORTABLE_EXPORT_PACKAGE_FORMAT) {
    throw fail(
      "unsupported_package_format",
      `Unsupported package_format: ${String(manifest.package_format ?? "")}`,
      { packageFormat: manifest.package_format ?? null },
    );
  }
  if (manifest.package_version !== PORTABLE_EXPORT_PACKAGE_VERSION) {
    throw fail(
      "unsupported_package_version",
      `Unsupported package_version: ${String(manifest.package_version ?? "")}`,
      { packageVersion: manifest.package_version ?? null },
    );
  }
}

function isAbsolutePortablePath(rawPath) {
  return path.isAbsolute(rawPath) || path.posix.isAbsolute(rawPath) || path.win32.isAbsolute(rawPath);
}

function assertPathInsideRoot(rootPath, resolvedPath, label) {
  const relative = path.relative(rootPath, resolvedPath);
  if (relative === "") {
    return;
  }
  if (
    relative === ".."
    || relative.startsWith(`..${path.sep}`)
    || relative.startsWith("../")
    || relative.startsWith("..\\")
    || path.isAbsolute(relative)
  ) {
    throw fail(
      "package_path_escape",
      `${label} resolves outside the inspected package root`,
      { resolvedPath, rootPath },
    );
  }
}

function normalizePackagePathValue(rawValue, label) {
  const rawPath = requireString(rawValue, label);
  if (rawPath.includes("\u0000")) {
    throw fail("invalid_package_path", `${label} contains a null byte`);
  }
  if (isAbsolutePortablePath(rawPath)) {
    throw fail("invalid_package_path", `${label} must be package-relative`, { path: rawPath });
  }
  const normalized = path.posix.normalize(rawPath.replace(/\\/gu, "/"));
  if (normalized === "." || normalized === "" || normalized.endsWith("/")) {
    throw fail("invalid_package_path", `${label} is malformed`, { path: rawPath });
  }
  return normalized;
}

function resolvePackagePath(packageRoot, relativePath, label) {
  const normalized = normalizePackagePathValue(relativePath, label);
  const resolved = path.resolve(packageRoot, ...normalized.split("/"));
  assertPathInsideRoot(packageRoot, resolved, label);
  return {
    normalized,
    resolved,
  };
}

async function assertReadablePath(filePath, code, message) {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw fail(code, message, { cause: error, path: filePath });
  }
}

async function statRequiredPath(filePath, code, message) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    throw fail(code, message, { cause: error, path: filePath });
  }
}

function buildReport(manifest, originalPath, artifactReports) {
  const representations = manifest.persisted.document_representations.map((representation) => ({
    id: representation.id ?? null,
    artifact_rel_path: representation.artifact_rel_path ?? null,
    has_package_artifacts: artifactReports.some((item) => item.representation_id === representation.id),
  }));
  return {
    package_format: manifest.package_format,
    package_version: manifest.package_version,
    file_binary: {
      id: manifest.persisted.file_binary.id ?? null,
      sha256: manifest.persisted.file_binary.sha256,
      actual_size_bytes: manifest.persisted.file_binary.actual_size_bytes ?? null,
    },
    original_relative_path: originalPath,
    representation_count: manifest.persisted.document_representations.length,
    processing_job_count: manifest.persisted.processing_jobs.length,
    comparison_count: manifest.persisted.document_representation_comparisons.length,
    selection_count: manifest.persisted.document_representation_selections.length,
    derived_effective_selection: manifest.derived.effective_selection,
    representations,
    representation_artifacts: artifactReports.map((item) => ({
      representation_id: item.representation_id,
      source_artifact_rel_path: item.source_artifact_rel_path ?? null,
      package_dir: item.package_dir,
      copied_file_count: item.copied_files.length,
      copied_files: item.copied_files.map((file) => file.relativePath),
    })),
  };
}

export async function inspectPortableBinaryExportPackage({ packageDir }) {
  const resolvedPackageDir = path.resolve(requireString(packageDir, "packageDir"));
  const manifestPath = path.join(resolvedPackageDir, "manifest.json");
  await assertReadablePath(
    manifestPath,
    "missing_manifest",
    `Portable export manifest not found: ${manifestPath}`,
  );

  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch (error) {
    throw fail("invalid_manifest", `Portable export manifest is malformed: ${manifestPath}`, { cause: error });
  }

  requirePlainObject(manifest, "manifest");
  assertSupportedPackageContract(manifest);

  const persisted = requirePlainObject(manifest.persisted, "manifest.persisted");
  const fileBinary = requirePlainObject(persisted.file_binary, "manifest.persisted.file_binary");
  const representations = requireArray(
    persisted.document_representations,
    "manifest.persisted.document_representations",
  );
  const processingJobs = requireArray(persisted.processing_jobs, "manifest.persisted.processing_jobs");
  const comparisons = requireArray(
    persisted.document_representation_comparisons,
    "manifest.persisted.document_representation_comparisons",
  );
  const selections = requireArray(
    persisted.document_representation_selections,
    "manifest.persisted.document_representation_selections",
  );
  const packageContents = requirePlainObject(manifest.package_contents, "manifest.package_contents");
  const originalBinary = requirePlainObject(
    packageContents.original_binary,
    "manifest.package_contents.original_binary",
  );
  const artifactEntries = requireArray(
    packageContents.representation_artifacts,
    "manifest.package_contents.representation_artifacts",
  );
  const derived = requirePlainObject(manifest.derived, "manifest.derived");
  requirePlainObject(derived.effective_selection, "manifest.derived.effective_selection");

  const canonicalSha = requireString(fileBinary.sha256, "manifest.persisted.file_binary.sha256");
  const canonicalSize = requireOptionalFiniteNumber(
    fileBinary.actual_size_bytes,
    "manifest.persisted.file_binary.actual_size_bytes",
  );
  const originalSha = requireString(
    originalBinary.sha256,
    "manifest.package_contents.original_binary.sha256",
  );
  const originalSize = requireOptionalFiniteNumber(
    originalBinary.size_bytes,
    "manifest.package_contents.original_binary.size_bytes",
  );
  if (originalSize === null) {
    throw fail(
      "invalid_manifest",
      "manifest.package_contents.original_binary.size_bytes must be present",
    );
  }

  const originalPathInfo = resolvePackagePath(
    resolvedPackageDir,
    originalBinary.package_path,
    "manifest.package_contents.original_binary.package_path",
  );
  const originalStats = await statRequiredPath(
    originalPathInfo.resolved,
    "missing_original",
    "Exported original binary is missing",
  );
  if (!originalStats.isFile()) {
    throw fail("missing_original", "Exported original binary is not a file", {
      path: originalPathInfo.resolved,
    });
  }

  if (Number(originalStats.size) !== originalSize) {
    throw fail("original_size_mismatch", "Exported original binary size mismatch", {
      actualSizeBytes: Number(originalStats.size),
      manifestSizeBytes: originalSize,
    });
  }
  if (canonicalSize !== null && Number(originalStats.size) !== canonicalSize) {
    throw fail("original_size_mismatch", "Exported original binary does not match canonical size", {
      actualSizeBytes: Number(originalStats.size),
      canonicalSizeBytes: canonicalSize,
    });
  }
  const computedOriginalSha = await sha256File(originalPathInfo.resolved);
  if (computedOriginalSha !== canonicalSha || computedOriginalSha !== originalSha) {
    throw fail("original_sha_mismatch", "Exported original binary SHA-256 mismatch", {
      computedSha256: computedOriginalSha,
      canonicalSha256: canonicalSha,
      manifestSha256: originalSha,
    });
  }

  const representationById = new Map();
  for (const representation of representations) {
    const record = requirePlainObject(representation, "manifest.persisted.document_representations[]");
    if (record.id === null || record.id === undefined) {
      throw fail("invalid_manifest", "Each persisted representation must include id");
    }
    representationById.set(record.id, record);
  }

  const artifactReports = [];
  const artifactEntryByRepresentationId = new Map();
  for (const entry of artifactEntries) {
    const artifactEntry = requirePlainObject(entry, "manifest.package_contents.representation_artifacts[]");
    const representationId = artifactEntry.representation_id;
    if (representationId === null || representationId === undefined) {
      throw fail("invalid_manifest", "Each representation_artifacts entry must include representation_id");
    }
    if (artifactEntryByRepresentationId.has(representationId)) {
      throw fail(
        "invalid_manifest",
        `Duplicate representation_artifacts entry for representation ${representationId}`,
      );
    }
    const representation = representationById.get(representationId);
    if (!representation) {
      throw fail(
        "invalid_manifest",
        `representation_artifacts entry references unknown representation ${representationId}`,
      );
    }
    if (!representation.artifact_rel_path) {
      throw fail(
        "invalid_manifest",
        `representation_artifacts entry references representation ${representationId} without persisted artifact_rel_path`,
      );
    }
    const packageDirInfo = resolvePackagePath(
      resolvedPackageDir,
      artifactEntry.package_dir,
      "manifest.package_contents.representation_artifacts[*].package_dir",
    );
    const copiedFiles = requireArray(
      artifactEntry.copied_files,
      "manifest.package_contents.representation_artifacts[*].copied_files",
    );
    for (const copiedFile of copiedFiles) {
      const copiedFileRecord = requirePlainObject(
        copiedFile,
        "manifest.package_contents.representation_artifacts[*].copied_files[]",
      );
      const copiedFileInfo = resolvePackagePath(
        packageDirInfo.resolved,
        copiedFileRecord.relativePath,
        "manifest.package_contents.representation_artifacts[*].copied_files[*].relativePath",
      );
      assertPathInsideRoot(
        resolvedPackageDir,
        copiedFileInfo.resolved,
        "manifest.package_contents.representation_artifacts[*].copied_files[*].relativePath",
      );
      const copiedStats = await statRequiredPath(
        copiedFileInfo.resolved,
        "missing_artifact_file",
        "Manifest-listed artifact file is missing",
      );
      if (!copiedStats.isFile()) {
        throw fail("missing_artifact_file", "Manifest-listed artifact path is not a file", {
          path: copiedFileInfo.resolved,
        });
      }
    }
    artifactEntryByRepresentationId.set(representationId, artifactEntry);
    artifactReports.push({
      representation_id: representationId,
      source_artifact_rel_path: artifactEntry.source_artifact_rel_path ?? null,
      package_dir: packageDirInfo.normalized,
      copied_files: copiedFiles.map((item) => ({
        relativePath: normalizePackagePathValue(
          item.relativePath,
          "manifest.package_contents.representation_artifacts[*].copied_files[*].relativePath",
        ),
      })),
    });
  }

  for (const representation of representations) {
    if (!representation.artifact_rel_path) {
      continue;
    }
    const artifactEntry = artifactEntryByRepresentationId.get(representation.id);
    if (!artifactEntry) {
      throw fail(
        "missing_artifact_entry",
        `Representation ${representation.id} has persisted artifact_rel_path but no package artifact entry`,
        { representationId: representation.id },
      );
    }
    if (artifactEntry.source_artifact_rel_path !== representation.artifact_rel_path) {
      throw fail(
        "artifact_entry_mismatch",
        `Representation ${representation.id} artifact entry does not match persisted artifact_rel_path`,
        {
          representationId: representation.id,
          persistedArtifactRelPath: representation.artifact_rel_path,
          sourceArtifactRelPath: artifactEntry.source_artifact_rel_path ?? null,
        },
      );
    }
  }

  return {
    packageDir: resolvedPackageDir,
    manifest,
    report: buildReport(
      {
        ...manifest,
        persisted: {
          ...manifest.persisted,
          document_representations: representations,
          processing_jobs: processingJobs,
          document_representation_comparisons: comparisons,
          document_representation_selections: selections,
          file_binary: fileBinary,
        },
        derived,
      },
      originalPathInfo.normalized,
      artifactReports,
    ),
  };
}
