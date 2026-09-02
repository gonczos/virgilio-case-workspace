import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectFactualExport } from "../app/factual-export-inspect.mjs";
import { exportFactualSlice } from "../app/factual-export.mjs";
import { prepareAiConsultationPackage } from "../app/ai-consultation-export.mjs";
import { assertProcessingSchema, getWorkspaceRoot, withClient } from "../app/processing-common.mjs";
import { countProcessingState } from "../app/processing-store.mjs";

const REPRESENTATIVE_SHAS = [
  "00445e909e62504134764a6c333277a3b90d1346a9da17f7c0de2529dbbe277e",
  "6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c",
];

test("factual slice exports and verifies multiple binaries without mutating processing state", async () => {
  await withClient("factual-export-test", async (client) => {
    await assertProcessingSchema(client);
    const before = await countProcessingState(client);
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-factual-export-"));
    try {
      const outputDir = path.join(tempRoot, "slice");
      const exported = await exportFactualSlice(client, {
        sha256s: REPRESENTATIVE_SHAS,
        outputDir,
        workspaceRoot: getWorkspaceRoot(),
      });
      assert.equal(exported.manifest.counts.binaries, 2);
      assert.deepEqual(exported.manifest.scope.sha256s, [...REPRESENTATIVE_SHAS].sort());
      for (const binary of exported.manifest.binaries) {
        const childManifest = JSON.parse(await fs.readFile(
          path.join(outputDir, binary.portable_manifest_path),
          "utf8",
        ));
        assert.equal(
          childManifest.persisted.buckets.every(
            (bucket) => !("displayed_bucket_size_bytes" in bucket),
          ),
          true,
        );
      }
      for (const name of ["README.md", "binary-index.csv", "document-context-index.csv", "processing-index.csv"]) {
        await fs.access(path.join(outputDir, name));
      }

      const inspected = await inspectFactualExport({ packageDir: outputDir });
      assert.equal(inspected.report.binary_count, 2);
      assert.equal(inspected.report.generated_file_count, 4);
      assert.deepEqual(inspected.report.binaries.map((row) => row.sha256), [...REPRESENTATIVE_SHAS].sort());

      const consultationDir = path.join(tempRoot, "consultation");
      const consultation = await prepareAiConsultationPackage({
        sourcePackageDir: outputDir,
        outputDir: consultationDir,
      });
      assert.equal(consultation.binaryCount, 2);
      await fs.access(path.join(consultationDir, "README.md"));
      await fs.access(path.join(consultationDir, "documents.csv"));
      for (const sha256 of REPRESENTATIVE_SHAS) {
        const documentDir = path.join(consultationDir, "documents", sha256);
        const names = await fs.readdir(documentDir);
        assert.equal(names.some((name) => name.startsWith("original.")), true);
        const metadata = JSON.parse(await fs.readFile(path.join(documentDir, "metadata.json"), "utf8"));
        assert.equal(metadata.sha256, sha256);
        assert.equal("processing_jobs" in metadata, false);
      }
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
    assert.deepEqual(await countProcessingState(client), before);
  });
});
