import { describe, expect, test } from "vitest";

import type { BinaryDetailResponse, RepresentationListItem } from "../types/consultation";
import {
  chooseInitialFormat,
  chooseInitialRepresentation,
  formatFileType,
  formatBytes,
  getProcessingLabel,
  getRepresentationLabel,
  getReferenceLocationLabel,
  getObservationTechnicalAnchors,
  getObservationKindLabel,
  getReferenceResultHeading,
  groupReferenceTextHits,
  isPdfBinary,
  prefersNativePdfViewer,
  sameStableId,
} from "./consultation";

test("formatBytes renders readable values", () => {
  expect(formatBytes(42)).toBe("42 B");
  expect(formatBytes(42 * 1024)).toBe("42 KB");
  expect(formatBytes(3.8 * 1024 * 1024)).toBe("3.8 MB");
});

test("chooseInitialFormat prefers markdown then text then complete-text then native-json", () => {
  expect(chooseInitialFormat({
    available_formats: ["native-json", "text", "markdown"],
  } as RepresentationListItem)).toBe("markdown");
  expect(chooseInitialFormat({
    available_formats: ["native-json", "text"],
  } as RepresentationListItem)).toBe("text");
  expect(chooseInitialFormat({
    available_formats: ["native-json", "complete-text"],
  } as RepresentationListItem)).toBe("complete-text");
  expect(chooseInitialFormat({
    available_formats: ["native-json"],
  } as RepresentationListItem)).toBe("native-json");
});

test("chooseInitialRepresentation prefers the effective representation", () => {
  const detail = {
    binary: { mime_type: "application/pdf", file_extension: ".pdf" },
    representations: {
      effective: { representation_id: 2 },
      items: [
        { representation_id: 1 },
        { representation_id: 2 },
      ],
    },
  } as unknown as BinaryDetailResponse;
  expect(chooseInitialRepresentation(detail)?.representation_id).toBe(2);
});

test("chooseInitialRepresentation falls back to the first available item", () => {
  const detail = {
    binary: { mime_type: "application/pdf", file_extension: ".pdf" },
    representations: {
      effective: null,
      items: [
        { representation_id: 7 },
        { representation_id: 8 },
      ],
    },
  } as unknown as BinaryDetailResponse;
  expect(chooseInitialRepresentation(detail)?.representation_id).toBe(7);
});

test("sameStableId treats bigint-backed API ids consistently across string and number forms", () => {
  expect(sameStableId("255", 255)).toBe(true);
  expect(sameStableId(254, "254")).toBe(true);
  expect(sameStableId("254", "255")).toBe(false);
  expect(sameStableId(null, 255)).toBe(false);
});

test("getProcessingLabel distinguishes processed, partial, failed, and idle states", () => {
  expect(getProcessingLabel({
    processing_summary: { status_counts: { completed: 2 } },
  } as never)).toBe("Processed");
  expect(getProcessingLabel({
    processing_summary: { status_counts: { completed: 1, failed: 1 } },
  } as never)).toBe("Partially processed");
  expect(getProcessingLabel({
    processing_summary: { status_counts: { failed: 2 } },
  } as never)).toBe("Failed");
  expect(getProcessingLabel({
    processing_summary: { status_counts: {} },
  } as never)).toBe("Not processed");
});

test("representation label and pdf detection stay presentation-only", () => {
  expect(getRepresentationLabel({ processor_key: "docling", representation_source_kind: "machine_generated" })).toBe("Docling");
  expect(getRepresentationLabel({ processor_key: "xberg", representation_source_kind: "machine_generated" })).toBe("Xberg");
  expect(getRepresentationLabel({ processor_key: "pdf_literal_text", representation_source_kind: "machine_generated" })).toBe("PDF literal text");
  expect(getRepresentationLabel({ processor_key: "pdf_signature_metadata", representation_source_kind: "machine_generated" })).toBe("PDF signature metadata");
  expect(getRepresentationLabel({ processor_key: "pdf_structure_inventory", representation_source_kind: "machine_generated" })).toBe("PDF structure inventory");
  expect(getRepresentationLabel({ processor_key: "pdf_ocr_text", representation_source_kind: "machine_generated" })).toBe("PDF OCR text");
  expect(getRepresentationLabel({ processor_key: "human", representation_source_kind: "human_authored" })).toBe("Human");
  expect(isPdfBinary({
    binary: { mime_type: "application/pdf", file_extension: ".pdf" },
  } as BinaryDetailResponse)).toBe(true);
});

test("formatFileType prefers extension labels and falls back to mime type", () => {
  expect(formatFileType("application/pdf", ".pdf")).toBe("PDF");
  expect(formatFileType("text/plain", ".txt")).toBe("TXT");
  expect(formatFileType("text/plain", null)).toBe("TXT");
  expect(formatFileType("application/octet-stream", null)).toBe("application/octet-stream");
});

test("prefersNativePdfViewer falls back for scanned pdf classes only", () => {
  expect(prefersNativePdfViewer({
    binary: { machine_readability_status: "image_only_pdf", mime_type: "application/pdf", file_extension: ".pdf" },
  } as BinaryDetailResponse)).toBe(true);
  expect(prefersNativePdfViewer({
    binary: { machine_readability_status: "mostly_image_pdf", mime_type: "application/pdf", file_extension: ".pdf" },
  } as BinaryDetailResponse)).toBe(true);
  expect(prefersNativePdfViewer({
    binary: { machine_readability_status: "text_pdf", mime_type: "application/pdf", file_extension: ".pdf" },
  } as BinaryDetailResponse)).toBe(false);
});

test("reference text hits group by binary without losing processor hits or occurrence contexts", () => {
  const base = {
    sha256: "a".repeat(64),
    source_contexts: [{ bucket_document_id: 1, document_id: 2 }],
  };
  const groups = groupReferenceTextHits([
    { ...base, processor_key: "docling" },
    {
      ...base,
      processor_key: "xberg",
      source_contexts: [
        { bucket_document_id: 1, document_id: 2 },
        { bucket_document_id: 3, document_id: 2 },
      ],
    },
    { ...base, sha256: "b".repeat(64), processor_key: "pdf_literal_text" },
  ] as never);
  expect(groups).toHaveLength(2);
  expect(groups[0].hits.map((hit) => hit.processor_key)).toEqual(["docling", "xberg"]);
  expect(groups[0].source_contexts).toHaveLength(2);
});

test("binary preview order is deterministic and starts with the highest-ranked passage", () => {
  const groups = groupReferenceTextHits([
    { sha256: "a".repeat(64), rank: 0.2, document_representation_id: 2, segment_id: 8, source_contexts: [] },
    { sha256: "a".repeat(64), rank: 0.8, document_representation_id: 3, segment_id: 9, source_contexts: [] },
    { sha256: "a".repeat(64), rank: 0.8, document_representation_id: 1, segment_id: 7, source_contexts: [] },
  ] as never);
  expect(groups[0].hits.map((hit) => hit.segment_id)).toEqual([7, 9, 8]);
});

test("reference observation labels distinguish source records from document mentions", () => {
  expect(getObservationKindLabel("source_record")).toBe("Recorded by source system");
  expect(getObservationKindLabel("metadata_row")).toBe("Recorded by source system");
  expect(getObservationKindLabel("segment")).toBe("Mentioned in document text");
});

test("reference location labels do not promote document or processor locations to verified pages", () => {
  expect(getReferenceLocationLabel("document_level", null, "reference")).toBe(
    "Exact match found in document. Page number cannot be determined.",
  );
  expect(getReferenceLocationLabel("document_level", null, "text")).toBe(
    "Text found in document. Page number cannot be determined.",
  );
  expect(getReferenceLocationLabel("processor_page_unverified", 3)).toContain("not verified");
  expect(getReferenceLocationLabel("verified_pdf_page", 3)).toBe("Verified PDF page 3");
  expect(getReferenceLocationLabel("source_record", null)).toBe("Source-system record");
});

test("submitted result headings retain their producing mode and query", () => {
  expect(getReferenceResultHeading("reference", "105398957")).toBe(
    "Exact-reference observations for “105398957”",
  );
  expect(getReferenceResultHeading("text", "despacho")).toBe(
    "Text-search results for “despacho”",
  );
});

test("technical reference details expose every stored extraction anchor", () => {
  const rows = getObservationTechnicalAnchors({
    binary_identity: { file_binary_id: 3, sha256: "a".repeat(64), detail_api_path: "/binary" },
    source_document_identity: { document_id: 4, source_document_reference: "source-4" },
    source_contexts: [],
    observation: {
      provenance: {
        file_binary_id: 3,
        document_id: 4,
        bucket_document_id: 5,
        occurrence_reference: "105492248",
        process_number: "13608/14.8T2SNT",
        document_representation_id: 6,
        document_segment_id: 7,
        processor_key: "pdf_literal_text",
        processor_version: "test",
        observer_key: "extractor",
        observer_version: "v1",
      },
      location: { kind: "document_level", pdf_page: null },
      char_start: 10,
      char_end: 19,
    },
    extractor_observation_state: "current",
  } as never);
  expect(Object.fromEntries(rows.map((row) => [row.label, row.value]))).toMatchObject({
    "Representation ID": "6",
    "Segment ID": "7",
    Processor: "pdf_literal_text",
    "Observer version": "v1",
    "Character start": "10",
    "Character end": "19",
  });
});
