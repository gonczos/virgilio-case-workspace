import { expect, test } from "vitest";

import { buildInspectionOptions } from "./InspectionViewer";
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
