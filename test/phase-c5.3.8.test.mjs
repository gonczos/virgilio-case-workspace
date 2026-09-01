import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  exportPortableBinaryPackage,
  loadPortableBinaryExportState,
  PORTABLE_EXPORT_PACKAGE_FORMAT,
  PORTABLE_EXPORT_PACKAGE_VERSION,
} from "../app/portable-export.mjs";
import {
  assertProcessingSchema,
  getWorkspaceRoot,
  withClient,
} from "../app/processing-common.mjs";
import { countProcessingState } from "../app/processing-store.mjs";

const REPRESENTATIVE_SHA = "6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c";

async function withRealClient(fn) {
  return withClient("phase-c5.3.8-test", async (client) => {
    await assertProcessingSchema(client);
    return fn(client);
  });
}

async function withTempDir(fn) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-c5.3.8-"));
  try {
    return await fn(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function findUnprocessedSha(client) {
  const result = await client.query(
    `
      SELECT fb.sha256
      FROM casework.file_binary AS fb
      LEFT JOIN casework.processing_job AS pj
        ON pj.file_binary_id = fb.id
      LEFT JOIN casework.document_representation AS dr
        ON dr.file_binary_id = fb.id
      GROUP BY fb.id, fb.sha256
      HAVING COUNT(pj.id) = 0
         AND COUNT(dr.id) = 0
      ORDER BY fb.id ASC
      LIMIT 1
    `,
  );
  return result.rows[0]?.sha256 ?? null;
}

function assertSortedAscending(values) {
  const sorted = [...values].sort((left, right) => left - right);
  assert.deepEqual(values, sorted);
}

test("loadPortableBinaryExportState reads the representative binary without mutating processing state", async () => {
  await withRealClient(async (client) => {
    const before = await countProcessingState(client);
    const state = await loadPortableBinaryExportState(client, { sha256: REPRESENTATIVE_SHA });
    const after = await countProcessingState(client);

    assert.equal(state.binary.sha256, REPRESENTATIVE_SHA);
    assert.equal(state.importBatch?.package_id, state.binary.storage_package_id);
    assert.equal(state.context.documents.length >= 1, true);
    assert.equal(state.context.documentBinaries.length >= 1, true);
    assert.equal(state.processing.jobs.length >= 1, true);
    assert.equal(state.representations.length >= 1, true);
    assert.equal(state.processing.comparisons.length >= 1, true);

    assert.deepEqual(after, before);
  });
});

test("exportPortableBinaryPackage writes a standalone rich package for the representative binary", async () => {
  await withRealClient(async (client) => {
    const before = await countProcessingState(client);
    await withTempDir(async (tempRoot) => {
      const outputDir = path.join(tempRoot, "representative-export");
      const result = await exportPortableBinaryPackage(client, {
        sha256: REPRESENTATIVE_SHA,
        outputDir,
        workspaceRoot: getWorkspaceRoot(),
      });

      const manifestPath = path.join(outputDir, "manifest.json");
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      assert.equal(result.manifest.package_format, PORTABLE_EXPORT_PACKAGE_FORMAT);
      assert.equal(result.manifest.package_version, PORTABLE_EXPORT_PACKAGE_VERSION);
      assert.equal(manifest.package_format, PORTABLE_EXPORT_PACKAGE_FORMAT);
      assert.equal(manifest.package_version, PORTABLE_EXPORT_PACKAGE_VERSION);
      assert.equal(manifest.persisted.file_binary.sha256, REPRESENTATIVE_SHA);
      assert.equal(path.isAbsolute(manifest.package_contents.original_binary.package_path), false);
      assert.equal(manifest.persisted.processing_jobs.length >= 1, true);
      assert.equal(manifest.persisted.document_representations.length >= 1, true);
      assert.equal(manifest.persisted.document_representation_comparisons.length >= 1, true);
      assert.equal(manifest.persisted.processing_jobs.some((job) => job.status === "failed"), true);
      assert.equal(manifest.persisted.processing_jobs.some((job) => job.status === "completed"), true);
      assert.equal(Array.isArray(manifest.package_contents.representation_artifacts), true);
      assert.equal(manifest.package_contents.representation_artifacts.length >= 1, true);

      const originalAbsPath = path.join(outputDir, manifest.package_contents.original_binary.package_path);
      assert.equal(await fs.stat(originalAbsPath).then(() => true), true);
      const representationIds = manifest.persisted.document_representations.map((item) => item.id);
      assertSortedAscending(representationIds);
      const processingJobIds = manifest.persisted.processing_jobs.map((item) => item.id);
      assertSortedAscending(processingJobIds);

      for (const artifactSet of manifest.package_contents.representation_artifacts) {
        assert.equal(path.isAbsolute(artifactSet.package_dir), false);
        for (const copiedFile of artifactSet.copied_files) {
          const copiedAbsPath = path.join(outputDir, artifactSet.package_dir, copiedFile.relativePath);
          const stats = await fs.stat(copiedAbsPath);
          assert.equal(Number(stats.size), copiedFile.sizeBytes);
        }
      }
    });
    const after = await countProcessingState(client);
    assert.deepEqual(after, before);
  });
});

test("exportPortableBinaryPackage exports an unprocessed binary with an honestly empty processing set", async () => {
  await withRealClient(async (client) => {
    const sha256 = await findUnprocessedSha(client);
    assert.ok(sha256);
    const before = await countProcessingState(client);
    await withTempDir(async (tempRoot) => {
      const outputDir = path.join(tempRoot, "unprocessed-export");
      const result = await exportPortableBinaryPackage(client, {
        sha256,
        outputDir,
        workspaceRoot: getWorkspaceRoot(),
      });
      const manifest = result.manifest;
      assert.equal(manifest.persisted.file_binary.sha256, sha256);
      assert.deepEqual(manifest.persisted.processing_jobs, []);
      assert.deepEqual(manifest.persisted.document_representations, []);
      assert.deepEqual(manifest.persisted.document_representation_comparisons, []);
      assert.deepEqual(manifest.persisted.document_representation_selections, []);
      assert.deepEqual(manifest.package_contents.representation_artifacts, []);
      const originalAbsPath = path.join(outputDir, manifest.package_contents.original_binary.package_path);
      assert.equal(await fs.stat(originalAbsPath).then(() => true), true);
    });
    const after = await countProcessingState(client);
    assert.deepEqual(after, before);
  });
});

test("exportPortableBinaryPackage rejects an existing output directory", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const outputDir = path.join(tempRoot, "already-there");
      await fs.mkdir(outputDir, { recursive: true });
      await assert.rejects(
        () => exportPortableBinaryPackage(client, {
          sha256: REPRESENTATIVE_SHA,
          outputDir,
          workspaceRoot: getWorkspaceRoot(),
        }),
        /Output directory already exists/u,
      );
    });
  });
});
