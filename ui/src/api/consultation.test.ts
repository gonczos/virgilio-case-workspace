import { expect, test } from "vitest";

import { normalizeBinaryDetailResponse } from "./consultation";
import type { BinaryDetailResponse } from "../types/consultation";

test("normalizeBinaryDetailResponse tolerates older detail payloads without evidence section", () => {
  const normalized = normalizeBinaryDetailResponse({
    binary: {
      file_binary_id: 1,
      sha256: "a".repeat(64),
      mime_type: "application/pdf",
      file_extension: ".pdf",
      machine_readability_status: "text_pdf",
      page_count: 1,
      size_bytes: 123,
      display_name: "Example",
      original_binary_url: "/binary/example",
    },
    context: {
      documents: [],
      buckets: [],
      cases: [],
      workspaces: [],
    },
    processing: {
      jobs: [],
      summary: {
        total_jobs: 0,
        status_counts: {},
        processor_keys: [],
        last_processed_at: null,
      },
    },
    representations: {
      items: [],
      effective: null,
      explicit_selection: null,
      effective_selection_reason: "automatic_policy",
    },
    comparisons: [],
    attention: {
      review_needed: false,
      reason_codes: [],
      reasons: [],
    },
    provenance: {
      effective_representation_id: null,
      selection_source: "automatic_policy",
      explicit_selection_id: null,
    },
    technical_details: {
      binary_id: 1,
      representation_ids: [],
      comparison_ids: [],
    },
  } as BinaryDetailResponse);

  expect(normalized.evidence.items).toEqual([]);
  expect(normalized.technical_details.evidence_representation_ids).toEqual([]);
  expect(normalized.technical_details.interpretation_representation_ids).toEqual([]);
  expect(normalized.technical_details.representation_ids).toEqual([]);
});
