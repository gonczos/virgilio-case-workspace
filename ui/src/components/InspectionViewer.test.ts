import { expect, test } from "vitest";

import { buildInspectionOptions, chooseInitialInspectionOption, findInspectionMatches, nextInspectionMatchCursor, orderInspectionSearchOptions } from "./InspectionViewer";
import type { RepresentationListItem } from "../types/consultation";

function representation(formats: string[]): RepresentationListItem {
  return {
    representation_id: 42,
    representation_source_kind: "machine_generated",
    representation_variant_key: "",
    representation_kind: "extracted_document_bundle",
    format_family: "pdf",
    processor_key: "docling",
    processor_version: "2.123.1",
    created_at: "2026-09-02T00:00:00.000Z",
    based_on_representation_id: null,
    produced_by_job_id: 7,
    produced_by_job_status: "completed",
    available_formats: formats,
    is_effective: true,
    is_explicitly_selected: false,
  };
}

function processorRepresentation(processorKey: string, id: number, formats: string[]): RepresentationListItem {
  return { ...representation(formats), processor_key: processorKey, representation_id: id };
}

test("inspection options flatten representation formats and markdown display modes", () => {
  const options = buildInspectionOptions("interpretation", [representation(["text", "markdown", "native-json"])]);

  expect(options.map((option) => option.label)).toEqual([
    "Docling — Text",
    "Docling — Rendered markdown",
    "Docling — Raw markdown",
    "Docling — Native JSON",
  ]);
  expect(options.every((option) => option.category === "interpretation")).toBe(true);
  expect(options[1].searchText).toContain("2.123.1");
});

test("evidence is ordered first and PDF literal text is the default evidence source", () => {
  const evidence = [
    ...buildInspectionOptions("evidence", [processorRepresentation("pdf_signature_metadata", 1, ["native-json"])]),
    ...buildInspectionOptions("evidence", [processorRepresentation("pdf_literal_text", 2, ["text"])]),
  ];
  const interpretations = buildInspectionOptions("interpretation", [processorRepresentation("docling", 3, ["markdown"])]);
  const options = [...evidence, ...interpretations];

  expect(options.map((option) => option.category)).toEqual(["evidence", "evidence", "interpretation", "interpretation"]);
  expect(chooseInitialInspectionOption(options, "evidence", null)?.representation?.processor_key).toBe("pdf_literal_text");
});

test("original PDF can be selected ahead of derived representations", () => {
  const original = {
    id: "original:pdf",
    category: "original" as const,
    representation: null,
    format: "pdf",
    renderMode: "raw" as const,
    label: "Original PDF — canonical evidence",
    searchText: "original PDF canonical evidence",
  };
  const options = [original, ...buildInspectionOptions("evidence", [processorRepresentation("pdf_literal_text", 2, ["text"])])];

  expect(chooseInitialInspectionOption(options, "original", null)).toBe(original);
});

test("inspection search finds case-insensitive literal matches with stable offsets", () => {
  expect(findInspectionMatches("Marie met MARIE and Mariana", "marie")).toEqual([
    { start: 0, end: 5 },
    { start: 10, end: 15 },
  ]);
});

test("inspection search treats punctuation as literal text", () => {
  expect(findInspectionMatches("Ref. 12 and RefX 12", "Ref. 12")).toEqual([{ start: 0, end: 7 }]);
});

test("cross-view search starts with the selected view and skips PDF and rendered duplicates", () => {
  const original = { id: "original:pdf", category: "original" as const, representation: null, format: "pdf", renderMode: "raw" as const, label: "Original", searchText: "original" };
  const evidence = buildInspectionOptions("evidence", [processorRepresentation("pdf_literal_text", 2, ["text"])]);
  const interpretations = buildInspectionOptions("interpretation", [processorRepresentation("docling", 3, ["markdown"])]);
  const options = [original, ...evidence, ...interpretations];

  expect(orderInspectionSearchOptions(options, interpretations[0]).map((option) => option.id)).toEqual([
    interpretations[1].id,
    evidence[0].id,
  ]);
});

test("cross-view match navigation advances and wraps in both directions", () => {
  expect(nextInspectionMatchCursor(1, 1, 3)).toBe(2);
  expect(nextInspectionMatchCursor(2, 1, 3)).toBe(0);
  expect(nextInspectionMatchCursor(0, -1, 3)).toBe(2);
  expect(nextInspectionMatchCursor(-1, 1, 3)).toBe(0);
  expect(nextInspectionMatchCursor(-1, -1, 3)).toBe(2);
  expect(nextInspectionMatchCursor(0, 1, 0)).toBe(-1);
});
