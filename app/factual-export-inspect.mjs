import fs from "node:fs/promises";
import path from "node:path";

import {
  FACTUAL_EXPORT_PACKAGE_FORMAT,
  FACTUAL_EXPORT_PACKAGE_VERSION,
} from "./factual-export-contract.mjs";
import { inspectPortableBinaryExportPackage } from "./portable-export-inspect.mjs";
import { readJson, sha256File } from "./processing-common.mjs";

function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Package path escapes export root: ${target}`);
  }
}

function resolveRelative(root, relativePath) {
  if (typeof relativePath !== "string" || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid package-relative path: ${String(relativePath)}`);
  }
  const target = path.resolve(root, ...relativePath.replace(/\\/gu, "/").split("/"));
  assertInside(root, target);
  return target;
}

export async function inspectFactualExport({ packageDir }) {
  const root = path.resolve(packageDir);
  const manifest = await readJson(path.join(root, "manifest.json"));
  if (manifest.package_format !== FACTUAL_EXPORT_PACKAGE_FORMAT) {
    throw new Error(`Unsupported factual export format: ${String(manifest.package_format)}`);
  }
  if (manifest.package_version !== FACTUAL_EXPORT_PACKAGE_VERSION) {
    throw new Error(`Unsupported factual export version: ${String(manifest.package_version)}`);
  }
  for (const file of manifest.generated_files ?? []) {
    const target = resolveRelative(root, file.path);
    const stats = await fs.stat(target);
    if (Number(stats.size) !== file.size_bytes || await sha256File(target) !== file.sha256) {
      throw new Error(`Generated file integrity mismatch: ${file.path}`);
    }
  }
  const binaryReports = [];
  for (const binary of manifest.binaries ?? []) {
    const childManifest = resolveRelative(root, binary.portable_manifest_path);
    if (await sha256File(childManifest) !== binary.portable_manifest_sha256) {
      throw new Error(`Portable manifest integrity mismatch: ${binary.sha256}`);
    }
    const packageRoot = resolveRelative(root, binary.package_directory);
    const result = await inspectPortableBinaryExportPackage({ packageDir: packageRoot });
    if (result.report.file_binary.sha256 !== binary.sha256) {
      throw new Error(`Portable package identity mismatch: ${binary.sha256}`);
    }
    binaryReports.push(result.report);
  }
  return {
    manifest,
    report: {
      package_format: manifest.package_format,
      package_version: manifest.package_version,
      binary_count: binaryReports.length,
      generated_file_count: manifest.generated_files.length,
      binaries: binaryReports.map((report) => ({
        sha256: report.file_binary.sha256,
        representation_count: report.representation_count,
        processing_job_count: report.processing_job_count,
      })),
    },
  };
}
