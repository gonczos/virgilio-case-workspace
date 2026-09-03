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

test("reference location labels do not promote document or processor locations to verified pages", () => {
  expect(getReferenceLocationLabel("document_level", null)).toContain("PDF page unavailable");
  expect(getReferenceLocationLabel("processor_page_unverified", 3)).toContain("not verified");
  expect(getReferenceLocationLabel("verified_pdf_page", 3)).toBe("Verified PDF page 3");
  expect(getReferenceLocationLabel("source_record", null)).toBe("Source-system record");
});
