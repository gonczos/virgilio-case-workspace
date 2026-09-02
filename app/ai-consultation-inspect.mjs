import fs from "node:fs/promises";
import path from "node:path";

import {
  AI_CONSULTATION_PACKAGE_FORMAT,
  AI_CONSULTATION_PACKAGE_VERSION,
} from "./ai-consultation-contract.mjs";
import { readJson, sha256File } from "./processing-common.mjs";

function resolvePackagePath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid package-relative path: ${String(relativePath)}`);
  }
  const target = path.resolve(root, ...relativePath.replace(/\\/gu, "/").split("/"));
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Package path escapes root: ${relativePath}`);
  }
  return target;
}

export async function inspectAiConsultationPackage({ packageDir }) {
  const root = path.resolve(packageDir);
  const manifest = await readJson(path.join(root, "manifest.json"));
  if (manifest.package_format !== AI_CONSULTATION_PACKAGE_FORMAT) {
    throw new Error(`Unsupported AI consultation package format: ${String(manifest.package_format)}`);
  }
  if (manifest.package_version !== AI_CONSULTATION_PACKAGE_VERSION) {
    throw new Error(`Unsupported AI consultation package version: ${String(manifest.package_version)}`);
  }
  if (manifest.hash_algorithm !== "sha256") throw new Error("Unsupported package hash algorithm");
  const paths = new Set();
  for (const file of manifest.files ?? []) {
    if (paths.has(file.path)) throw new Error(`Duplicate inventory path: ${file.path}`);
    paths.add(file.path);
    const target = resolvePackagePath(root, file.path);
    const stats = await fs.stat(target);
    if (Number(stats.size) !== file.size_bytes || await sha256File(target) !== file.sha256) {
      throw new Error(`Package file integrity mismatch: ${file.path}`);
    }
  }
  const actualPaths = (await fs.readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name !== "manifest.json")
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).replace(/\\/gu, "/"))
    .sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify([...paths].sort())) {
    throw new Error("Package file inventory is incomplete or contains an undeclared path");
  }
  const documents = manifest.documents ?? [];
  if (documents.length !== manifest.binary_count) throw new Error("Manifest binary count mismatch");
  const identities = documents.map((item) => item.sha256);
  if (new Set(identities).size !== identities.length || identities.some((value) => !/^[a-f0-9]{64}$/u.test(value))) {
    throw new Error("Invalid or duplicate binary identity");
  }
  if (JSON.stringify(identities) !== JSON.stringify([...identities].sort())) {
    throw new Error("Manifest documents are not deterministically ordered");
  }
  let actionableWarningCount = 0;
  for (const document of documents) {
    if (!paths.has(document.metadata_path) || !paths.has(document.original_path)) {
      throw new Error(`Document files missing from inventory: ${document.sha256}`);
    }
    const metadata = await readJson(resolvePackagePath(root, document.metadata_path));
    if (metadata.source_binary?.sha256 !== document.sha256) throw new Error(`Metadata identity mismatch: ${document.sha256}`);
    const original = resolvePackagePath(root, document.original_path);
    if (await sha256File(original) !== document.sha256) throw new Error(`Original binary identity mismatch: ${document.sha256}`);
    for (const artifact of metadata.extracted_artifacts ?? []) {
      const artifactPath = path.posix.join(path.posix.dirname(document.metadata_path), artifact.relative_path);
      if (!paths.has(artifactPath)) throw new Error(`Extracted artifact missing from inventory: ${artifactPath}`);
      resolvePackagePath(root, artifactPath);
      if (artifact.source_binary_sha256 !== document.sha256) throw new Error(`Artifact lineage mismatch: ${artifactPath}`);
    }
    const actionable = (metadata.diagnostics ?? []).filter((item) => item.actionable);
    actionableWarningCount += actionable.length;
    const warningPath = path.posix.join(path.posix.dirname(document.metadata_path), "warnings.md");
    if (paths.has(warningPath) !== (actionable.length > 0)) {
      throw new Error(`Warning rendering mismatch: ${document.sha256}`);
    }
  }
  if (!paths.has(manifest.index_path)) throw new Error("Package index is missing from inventory");
  resolvePackagePath(root, manifest.index_path);
  resolvePackagePath(root, manifest.documents_root_path);
  return {
    manifest,
    report: {
      package_format: manifest.package_format,
      package_version: manifest.package_version,
      binary_count: manifest.binary_count,
      inventoried_file_count: manifest.files.length,
      actionable_warning_count: actionableWarningCount,
    },
  };
}
