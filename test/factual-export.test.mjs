import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectFactualExport } from "../app/factual-export-inspect.mjs";
import { exportFactualSlice } from "../app/factual-export.mjs";
import {
  classifyUnavailableProcessor,
  compareProcessorTexts,
  prepareAiConsultationPackage,
  toCsv,
} from "../app/ai-consultation-export.mjs";
import { inspectAiConsultationPackage } from "../app/ai-consultation-inspect.mjs";
import { assertProcessingSchema, getWorkspaceRoot, withClient } from "../app/processing-common.mjs";
import { countProcessingState } from "../app/processing-store.mjs";

const REPRESENTATIVE_SHAS = [
  "00445e909e62504134764a6c333277a3b90d1346a9da17f7c0de2529dbbe277e",
  "02c8e7cee7eca2f83b98d64aa2dd64b1b888039210a8cbf5c2133322d1b1757e",
  "17eb40fa6ca2c37156d9c230640ff03efbddfa531111f09bb03a7152f9e4a691",
  "6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c",
  "9d335b7bb946796c51c965d2cf39d8d6a0279e4d8a4bad558d13174e99d1fe79",
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
      assert.equal(exported.manifest.counts.binaries, 5);
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
      assert.equal(inspected.report.binary_count, 5);
      assert.equal(inspected.report.generated_file_count, 4);
      assert.deepEqual(inspected.report.binaries.map((row) => row.sha256), [...REPRESENTATIVE_SHAS].sort());

      const consultationDir = path.join(tempRoot, "consultation");
      const consultation = await prepareAiConsultationPackage({
        sourcePackageDir: outputDir,
        outputDir: consultationDir,
      });
      assert.equal(consultation.binaryCount, 5);
      await fs.access(path.join(consultationDir, "README.md"));
      await fs.access(path.join(consultationDir, "documents.csv"));
      for (const sha256 of REPRESENTATIVE_SHAS) {
        const documentDir = path.join(consultationDir, "documents", sha256);
        const names = await fs.readdir(documentDir);
        assert.equal(names.some((name) => name.startsWith("original.")), true);
        const metadata = JSON.parse(await fs.readFile(path.join(documentDir, "metadata.json"), "utf8"));
        assert.equal(metadata.source_binary.sha256, sha256);
        assert.equal("processing_jobs" in metadata, false);
        assert.equal(metadata.diagnostics.some((item) => "first_different_line" in item), false);
      }
      const consultationInspection = await inspectAiConsultationPackage({ packageDir: consultationDir });
      assert.equal(consultationInspection.report.binary_count, 5);
      assert.equal(consultationInspection.manifest.index_path, "documents.csv");
      assert.equal(consultationInspection.manifest.original_binaries_included, true);

      const limited = JSON.parse(await fs.readFile(path.join(
        consultationDir,
        "documents",
        REPRESENTATIVE_SHAS[0],
        "metadata.json",
      ), "utf8"));
      assert.equal(limited.extracted_artifacts.some((item) => item.processor === "docling"), true);
      assert.equal(limited.extracted_artifacts.some((item) => item.processor === "xberg"), false);
      assert.equal(limited.diagnostics.some((item) => item.code === "PROCESSOR_OUTPUT_EMPTY" && item.processor === "xberg"), true);
      assert.equal(limited.diagnostics.some((item) => item.code === "PROCESSOR_OUTPUTS_TEXTUALLY_NON_IDENTICAL"), false);
      assert.equal(limited.source_binary.page_count, 1);
      assert.equal(limited.source_binary.pdf_characteristics.raster_page_content, "present");

      for (const sha256 of [REPRESENTATIVE_SHAS[1], REPRESENTATIVE_SHAS[2], REPRESENTATIVE_SHAS[4]]) {
        const metadata = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", sha256, "metadata.json"), "utf8"));
        const comparison = metadata.diagnostics.find((item) => item.code === "PROCESSOR_OUTPUTS_TEXTUALLY_NON_IDENTICAL");
        assert.equal(comparison.substantive_disagreement_assessment, "not_assessed");
        assert.equal("severity" in comparison, false);
      }
      const scannedEleven = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", REPRESENTATIVE_SHAS[1], "metadata.json"), "utf8"));
      assert.equal(scannedEleven.source_binary.page_count, 11);
      assert.equal(scannedEleven.diagnostics.some((item) => item.code === "SOURCE_PDF_NO_NATIVE_TEXT"), true);
      const bornDigital = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", REPRESENTATIVE_SHAS[2], "metadata.json"), "utf8"));
      assert.equal(bornDigital.source_binary.pdf_characteristics.native_text, "present");
      const signed = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", REPRESENTATIVE_SHAS[3], "metadata.json"), "utf8"));
      assert.equal(signed.source_binary.pdf_characteristics.signature_fields_or_dictionaries, "present");
      assert.equal(signed.extracted_artifacts.some((item) => item.artifact_kind === "pdf_signature_metadata"), true);
      const scannedLong = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", REPRESENTATIVE_SHAS[4], "metadata.json"), "utf8"));
      assert.equal(scannedLong.source_binary.page_count, 88);
      assert.equal(scannedLong.diagnostics.some((item) => item.code === "SOURCE_PDF_NO_NATIVE_TEXT"), true);
      const multiProcess = JSON.parse(await fs.readFile(path.join(
        consultationDir,
        "documents",
        REPRESENTATIVE_SHAS[2],
        "metadata.json",
      ), "utf8"));
      assert.equal(new Set(multiProcess.linked_source_documents.flatMap((item) => item.occurrences.map((row) => row.process_number))).size, 2);

      const packageManifestPath = path.join(consultationDir, "manifest.json");
      const validManifestText = await fs.readFile(packageManifestPath, "utf8");
      const unsafeManifest = JSON.parse(validManifestText);
      unsafeManifest.files[0].path = "../escape";
      await fs.writeFile(packageManifestPath, `${JSON.stringify(unsafeManifest, null, 2)}\n`, "utf8");
      await assert.rejects(() => inspectAiConsultationPackage({ packageDir: consultationDir }), /escapes root/u);
      await fs.writeFile(packageManifestPath, validManifestText, "utf8");
      const validManifest = JSON.parse(validManifestText);
      await fs.rm(path.join(consultationDir, ...validManifest.files.find((item) => item.path.includes("interpretations/")).path.split("/")));
      await assert.rejects(() => inspectAiConsultationPackage({ packageDir: consultationDir }), /ENOENT|integrity mismatch/u);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
    assert.deepEqual(await countProcessingState(client), before);
  });
});

test("AI consultation diagnostics distinguish failed and unknown processor states", () => {
  const failed = classifyUnavailableProcessor("xberg", [{ status: "failed" }]);
  assert.equal(failed.code, "PROCESSOR_JOB_FAILED");
  assert.equal(failed.severity, "warning");
  const unknown = classifyUnavailableProcessor("xberg", []);
  assert.equal(unknown.code, "PROCESSOR_OUTPUT_UNKNOWN");
  assert.equal(unknown.state, "unknown");
  assert.equal("severity" in unknown, false);
});

test("AI consultation comparison treats formatting and accents as non-substantive", () => {
  for (const [docling, xberg] of [
    ["ETUDE\nTexte identique", "ÉTUDE\nTexte identique"],
    ["Tribunal Judicial\nProcesso 123", "Processo 123\nTribunal Judicial"],
  ]) {
    const diagnostics = compareProcessorTexts(docling, xberg);
    const difference = diagnostics.find((item) => item.code === "PROCESSOR_OUTPUTS_TEXTUALLY_NON_IDENTICAL");
    assert.equal(difference.substantive_disagreement_assessment, "not_assessed");
    assert.equal(difference.actionable, false);
    assert.equal("severity" in difference, false);
    assert.equal(diagnostics.some((item) => item.code === "LARGE_TEXT_COVERAGE_DIFFERENCE"), false);
  }
});

test("AI consultation comparison warns only for a large measurable coverage gap", () => {
  const diagnostics = compareProcessorTexts("A complete document with substantial repeated content ".repeat(20), "short text");
  const coverage = diagnostics.find((item) => item.code === "LARGE_TEXT_COVERAGE_DIFFERENCE");
  assert.equal(coverage.severity, "warning");
  assert.equal(coverage.actionable, true);
});

test("AI consultation CSV serializer quotes commas, quotes, and newlines", () => {
  assert.equal(
    toCsv(["name", "note"], [{ name: "Doe, Jane", note: "said \"yes\"\nagain" }]),
    "name,note\n\"Doe, Jane\",\"said \"\"yes\"\"\nagain\"\n",
  );
});
