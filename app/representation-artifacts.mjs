import fs from "node:fs/promises";
import path from "node:path";

import {
  LEGACY_PHASE_C2_OUTPUT_ROOT,
  PROCESSING_OUTPUT_ROOT,
  readJson,
} from "./processing-common.mjs";

export class RepresentationArtifactError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RepresentationArtifactError";
    this.code = code;
    this.details = details;
  }
}

export function isRepresentationArtifactError(error) {
  return error instanceof RepresentationArtifactError;
}

const FORMAT_FILE_NAMES = new Map([
  ["complete-text", "complete-text.txt"],
  ["markdown", "markdown.md"],
  ["native-json", "native.json"],
]);

function getAllowedArtifactRoots(workspaceRoot) {
  return [
    path.resolve(workspaceRoot, PROCESSING_OUTPUT_ROOT),
    path.resolve(workspaceRoot, LEGACY_PHASE_C2_OUTPUT_ROOT),
  ];
}

function assertAllowedFormat(format) {
  const fileName = FORMAT_FILE_NAMES.get(format);
  if (!fileName) {
    throw new RepresentationArtifactError(
      "invalid_representation_format",
      `Unsupported representation format: ${format}`,
      { format },
    );
  }
  return fileName;
}

function resolveArtifactDir(workspaceRoot, representation) {
  if (!representation?.artifact_rel_path) {
    throw new RepresentationArtifactError(
      "representation_format_not_available",
      `Representation ${representation?.id ?? "unknown"} does not have retained artifacts`,
      { representationId: representation?.id ?? null },
    );
  }
  const resolvedPath = path.resolve(workspaceRoot, representation.artifact_rel_path);
  const allowedRoots = getAllowedArtifactRoots(workspaceRoot);
  const withinAllowedRoot = allowedRoots.some((allowedRoot) => resolvedPath.startsWith(allowedRoot));
  if (!withinAllowedRoot) {
    throw new RepresentationArtifactError(
      "representation_artifact_invalid",
      `Representation artifact path escapes allowed roots for representation ${representation.id}`,
      { representationId: representation.id },
    );
  }
  return resolvedPath;
}

export function resolveRepresentationArtifactDir(workspaceRoot, representation) {
  return resolveArtifactDir(workspaceRoot, representation);
}

async function listFilesRecursive(dirPath, currentRelPath = "") {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name, "en"));
  const files = [];
  for (const entry of sorted) {
    const nextRelPath = currentRelPath ? path.join(currentRelPath, entry.name) : entry.name;
    const absPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absPath, nextRelPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const stats = await fs.stat(absPath);
    files.push({
      relativePath: nextRelPath.replace(/\\/gu, "/"),
      sizeBytes: Number(stats.size),
    });
  }
  return files;
}

async function assertReadableFile(filePath, representationId, format) {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new RepresentationArtifactError(
      "representation_format_not_available",
      `Representation ${representationId} does not have readable ${format} content`,
      { cause: error, representationId, format },
    );
  }
}

export async function hasRepresentationArtifactFormat(workspaceRoot, representation, format) {
  try {
    const fileName = assertAllowedFormat(format);
    const artifactDir = resolveArtifactDir(workspaceRoot, representation);
    await fs.access(path.join(artifactDir, fileName));
    return true;
  } catch (error) {
    if (isRepresentationArtifactError(error)) {
      return false;
    }
    return false;
  }
}

export async function readRepresentationArtifact(workspaceRoot, representation, format) {
  const fileName = assertAllowedFormat(format);
  const artifactDir = resolveArtifactDir(workspaceRoot, representation);
  const artifactPath = path.join(artifactDir, fileName);
  await assertReadableFile(artifactPath, representation.id, format);
  if (format === "native-json") {
    try {
      return {
        format,
        contentType: "application/json; charset=utf-8",
        body: await readJson(artifactPath),
      };
    } catch (error) {
      throw new RepresentationArtifactError(
        "representation_artifact_failed",
        `Representation ${representation.id} has invalid native JSON`,
        { cause: error, representationId: representation.id, format },
      );
    }
  }
  return {
    format,
    contentType: format === "markdown" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
    body: await fs.readFile(artifactPath, "utf8"),
  };
}

export async function listRepresentationArtifactFiles(workspaceRoot, representation) {
  const artifactDir = resolveArtifactDir(workspaceRoot, representation);
  return listFilesRecursive(artifactDir);
}
