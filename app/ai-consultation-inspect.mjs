import fs from "node:fs/promises";
import path from "node:path";

import {
  AI_CONSULTATION_PACKAGE_FORMAT,
  AI_CONSULTATION_SUPPORTED_VERSIONS,
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
  if (!AI_CONSULTATION_SUPPORTED_VERSIONS.includes(manifest.package_version)) {
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
    if (manifest.package_version >= 2) {
      const pageTraceabilityPath = path.posix.join(path.posix.dirname(document.metadata_path), metadata.page_traceability_path);
      if (!paths.has(pageTraceabilityPath)) throw new Error(`Page traceability missing from inventory: ${document.sha256}`);
      const pageTraceability = await readJson(resolvePackagePath(root, pageTraceabilityPath));
      if (pageTraceability.source_binary_sha256 !== document.sha256) {
        throw new Error(`Page traceability lineage mismatch: ${document.sha256}`);
      }
      if (pageTraceability.schema_version >= 2) {
        for (const [processor, channel] of Object.entries(pageTraceability.channels ?? {})) {
          if (channel.page_mapping_status !== "available") continue;
          const pageNumbers = (channel.pages ?? []).map((page) => page.pdf_page_number);
          if (pageNumbers.some((pageNumber) => !Number.isInteger(pageNumber)
            || pageNumber < 1
            || pageNumber > pageTraceability.pdf_page_count)) {
            throw new Error(`Invalid ${processor} page number: ${document.sha256}`);
          }
          if (JSON.stringify(pageNumbers) !== JSON.stringify([...pageNumbers].sort((left, right) => left - right))) {
            throw new Error(`Non-deterministic ${processor} page ordering: ${document.sha256}`);
          }
          if (processor === "docling") {
            if (channel.projection_kind !== "processor_attributed_page_items"
              || channel.processor !== "docling"
              || !channel.processor_version
              || channel.source_artifact !== "native.json"
              || !/^[a-f0-9]{64}$/u.test(channel.source_artifact_sha256 ?? "")
              || channel.source_artifact_included !== false
              || channel.source_artifact_retention !== "verified_in_factual_source_package") {
              throw new Error(`Incomplete Docling page lineage: ${document.sha256}`);
            }
          }
        }
      }
      if (metadata.identifier_preservation_path) {
        const identifierPath = path.posix.join(
          path.posix.dirname(document.metadata_path),
          metadata.identifier_preservation_path,
        );
        if (!paths.has(identifierPath)) throw new Error(`Identifier inventory missing: ${document.sha256}`);
        const identifiers = await readJson(resolvePackagePath(root, identifierPath));
        if (identifiers.source_binary_sha256 !== document.sha256) {
          throw new Error(`Identifier inventory lineage mismatch: ${document.sha256}`);
        }
        const doclingChannel = pageTraceability.channels?.docling;
        if (identifiers.candidate_source?.processor !== "docling"
          || identifiers.candidate_source?.native_artifact_sha256 !== doclingChannel?.source_artifact_sha256) {
          throw new Error(`Identifier inventory source mismatch: ${document.sha256}`);
        }
        const normalizedValues = (identifiers.identifiers ?? []).map((item) => item.normalized_value);
        if (JSON.stringify(normalizedValues) !== JSON.stringify([...normalizedValues].sort())) {
          throw new Error(`Non-deterministic identifier ordering: ${document.sha256}`);
        }
      }
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
  if (manifest.package_version >= 2) {
    for (const requiredPath of [manifest.occurrences_index_path, manifest.coverage_report_path]) {
      if (!paths.has(requiredPath)) throw new Error(`Required package report missing from inventory: ${requiredPath}`);
      resolvePackagePath(root, requiredPath);
    }
  }
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
