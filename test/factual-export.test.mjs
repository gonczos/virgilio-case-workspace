import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectFactualExport } from "../app/factual-export-inspect.mjs";
import { exportFactualSlice } from "../app/factual-export.mjs";
import {
  buildDoclingPageProjection,
  buildIdentifierPreservationInventory,
  classifyUnavailableProcessor,
  compareProcessorTexts,
  prepareAiConsultationPackage,
  sourceCalendarDate,
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
      await fs.access(path.join(consultationDir, "occurrences.csv"));
      await fs.access(path.join(consultationDir, "coverage.json"));
      for (const sha256 of REPRESENTATIVE_SHAS) {
        const documentDir = path.join(consultationDir, "documents", sha256);
        const names = await fs.readdir(documentDir);
        assert.equal(names.some((name) => name.startsWith("original.")), true);
        const metadata = JSON.parse(await fs.readFile(path.join(documentDir, "metadata.json"), "utf8"));
        assert.equal(metadata.source_binary.sha256, sha256);
        assert.equal(metadata.schema_version, 2);
        await fs.access(path.join(documentDir, metadata.page_traceability_path));
        await fs.access(path.join(documentDir, metadata.identifier_preservation_path));
        assert.equal("processing_jobs" in metadata, false);
        assert.equal(metadata.diagnostics.some((item) => "first_different_line" in item), false);
      }
      const consultationInspection = await inspectAiConsultationPackage({ packageDir: consultationDir });
      assert.equal(consultationInspection.report.binary_count, 5);
      assert.equal(consultationInspection.manifest.index_path, "documents.csv");
      assert.equal(consultationInspection.manifest.package_version, 2);
      assert.equal(consultationInspection.manifest.occurrences_index_path, "occurrences.csv");
      assert.equal(consultationInspection.manifest.coverage_report_path, "coverage.json");
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
      assert.equal(limited.linked_source_documents[0].document_date, "2020-09-01");
      const limitedPages = JSON.parse(await fs.readFile(path.join(
        consultationDir,
        "documents",
        REPRESENTATIVE_SHAS[0],
        "page-traceability.json",
      ), "utf8"));
      assert.equal(limitedPages.channels.pdf_literal_text.pages[0].text_presence, "present");
      assert.equal(limitedPages.channels.pdf_literal_text.pages[0].alphanumeric_character_count, 6);
      assert.equal(limitedPages.channels.pdf_literal_text.pages[0].extraction_volume_assessment, "nearly_empty");
      assert.equal("has_meaningful_text" in limitedPages.channels.pdf_literal_text.pages[0], false);

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
      assert.equal(bornDigital.navigation_label.authority, "generated_non_authoritative");
      const bornDigitalPages = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", REPRESENTATIVE_SHAS[2], "page-traceability.json"), "utf8"));
      assert.equal(bornDigitalPages.source_native_text_assessment.length, 5);
      assert.equal(bornDigitalPages.channels.pdf_literal_text.page_mapping_status, "available");
      assert.equal(bornDigitalPages.channels.pdf_literal_text.pages.length, 5);
      assert.equal(bornDigitalPages.channels.docling.page_mapping_status, "available");
      assert.equal(bornDigitalPages.channels.docling.pages.length, 5);
      assert.equal(bornDigitalPages.channels.docling.markdown_offset_mapping_status, "unavailable");
      assert.equal(bornDigitalPages.channels.docling.source_artifact_included, false);
      assert.equal(bornDigitalPages.channels.docling.source_artifact_retention, "verified_in_factual_source_package");
      assert.equal(bornDigitalPages.channels.xberg.page_mapping_status, "unavailable");
      const signed = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", REPRESENTATIVE_SHAS[3], "metadata.json"), "utf8"));
      assert.equal(signed.source_binary.pdf_characteristics.signature_field_or_dictionary_presence, "present");
      assert.equal(signed.source_binary.pdf_characteristics.populated_signature_field_count, 1);
      assert.equal(signed.source_binary.pdf_characteristics.cryptographic_signature_validation_status, "not_performed");
      assert.equal(signed.extracted_artifacts.some((item) => item.artifact_kind === "pdf_signature_metadata"), true);
      const signedIdentifiers = JSON.parse(await fs.readFile(path.join(
        consultationDir,
        "documents",
        REPRESENTATIVE_SHAS[3],
        "identifier-preservation.json",
      ), "utf8"));
      const signedReference = signedIdentifiers.identifiers.find((item) => item.normalized_value === "134937241");
      assert.deepEqual(signedReference.pdf_pages, [1, 2, 3, 4, 5]);
      const scannedLong = JSON.parse(await fs.readFile(path.join(consultationDir, "documents", REPRESENTATIVE_SHAS[4], "metadata.json"), "utf8"));
      assert.equal(scannedLong.source_binary.page_count, 88);
      assert.equal(scannedLong.diagnostics.some((item) => item.code === "SOURCE_PDF_NO_NATIVE_TEXT"), true);
      const scannedLongPages = JSON.parse(await fs.readFile(path.join(
        consultationDir,
        "documents",
        REPRESENTATIVE_SHAS[4],
        "page-traceability.json",
      ), "utf8"));
      assert.equal(scannedLongPages.channels.docling.pages.length, 88);
      assert.equal(scannedLongPages.channels.docling.unmapped_item_count, 0);
      const multiProcess = JSON.parse(await fs.readFile(path.join(
        consultationDir,
        "documents",
        REPRESENTATIVE_SHAS[2],
        "metadata.json",
      ), "utf8"));
      assert.equal(new Set(multiProcess.linked_source_documents.flatMap((item) => item.occurrences.map((row) => row.process_number))).size, 2);
      const occurrences = await fs.readFile(path.join(consultationDir, "occurrences.csv"), "utf8");
      assert.equal(occurrences.trimEnd().split("\n").length, 12);
      assert.match(occurrences, /^occurrence_date,process_number,/u);
      const occurrenceDates = occurrences.trimEnd().split("\n").slice(1).map((line) => line.slice(0, 10));
      assert.deepEqual(occurrenceDates, [...occurrenceDates].sort());
      const coverage = JSON.parse(await fs.readFile(path.join(consultationDir, "coverage.json"), "utf8"));
      assert.equal(coverage.included_binary_count, 5);
      assert.equal(coverage.procedural_occurrence_count, 11);
      assert.equal(coverage.source_documents_without_binaries, "unknown_not_available_in_selected_factual_package");

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

test("AI consultation preserves Portuguese source calendar dates", () => {
  assert.equal(sourceCalendarDate("2020-08-31T23:00:00.000Z"), "2020-09-01");
  assert.equal(sourceCalendarDate("2022-01-13"), "2022-01-13");
  assert.equal(sourceCalendarDate(null), null);
});

test("Docling native page projection retains attributed page provenance", () => {
  const projection = buildDoclingPageProjection({
    body: { children: [{ $ref: "#/groups/0" }] },
    furniture: { children: [{ $ref: "#/texts/1" }] },
    groups: [{ self_ref: "#/groups/0", children: [{ $ref: "#/texts/0" }] }],
    texts: [
      {
        self_ref: "#/texts/0",
        label: "text",
        content_layer: "body",
        text: "Page two",
        prov: [{ page_no: 2, bbox: { l: 1, t: 2, r: 3, b: 4 }, charspan: [0, 8] }],
      },
      {
        self_ref: "#/texts/1",
        label: "page_header",
        content_layer: "furniture",
        text: "Header",
        prov: [{ page_no: 1, bbox: { l: 5, t: 6, r: 7, b: 8 }, charspan: [0, 6] }],
      },
    ],
    tables: [],
    pictures: [],
    key_value_items: [],
    form_items: [],
  });
  assert.equal(projection.mapped_item_count, 2);
  assert.equal(projection.unmapped_item_count, 0);
  assert.deepEqual(projection.pages.map((page) => page.pdf_page_number), [1, 2]);
  assert.equal(projection.pages[1].items[0].native_item_reference, "#/texts/0");
  assert.equal(projection.pages[1].items[0].text, "Page two");
});

test("identifier inventory reports attributed textual coverage without correctness claims", () => {
  const inventory = buildIdentifierPreservationInventory({
    sourceBinarySha256: "a".repeat(64),
    doclingChannel: {
      processor: "docling",
      processor_version: "test-version",
      processor_profile: "test-profile",
      projection_kind: "processor_attributed_page_items",
      source_artifact: "native.json",
      source_artifact_sha256: "b".repeat(64),
      pages: [{
        pdf_page_number: 2,
        items: [{ native_item_reference: "#/texts/1", text: "Case 13608/14.8T2SNT ref 134937241" }],
      }],
    },
    readableOutputs: {
      docling: { available: true, text: "Case 13608-14.8T2SNT", processorVersion: "test-version", relativePath: "interpretations/docling.md" },
      xberg: { available: false, text: "", processorVersion: null, relativePath: null },
    },
  });
  const caseNumber = inventory.identifiers.find((item) => item.normalized_value === "13608148T2SNT");
  const reference = inventory.identifiers.find((item) => item.normalized_value === "134937241");
  assert.equal(caseNumber.output_presence.docling, "present");
  assert.equal(caseNumber.output_presence.xberg, "unknown");
  assert.equal(reference.output_presence.docling, "absent");
  assert.deepEqual(reference.pdf_pages, [2]);
  assert.match(inventory.method.limitations[1], /not correctness/u);
});
