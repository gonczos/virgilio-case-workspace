import { afterEach, expect, test, vi } from "vitest";

import {
  lookupPilotReference,
  lookupRecordedReferences,
  normalizeBinaryDetailResponse,
  searchText,
} from "./consultation";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  });

  expect(normalized.evidence.items).toEqual([]);
  expect(normalized.technical_details.evidence_representation_ids).toEqual([]);
  expect(normalized.technical_details.interpretation_representation_ids).toEqual([]);
  expect(normalized.technical_details.representation_ids).toEqual([]);
});

test("pilot API clients preserve explicit reference and text modes", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ fixture: {}, items: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await lookupPilotReference("REF / 123");
  await searchText("despacho 105398957", {
    limit: 25, offset: 50, scope: "full", sort: "earliest_occurrence_asc",
  });

  expect(fetchMock.mock.calls[0][0]).toBe(
    "/api/consultation/reference-pilot/references/REF%20%2F%20123",
  );
  expect(fetchMock.mock.calls[1][0]).toBe(
    "/api/consultation/reference-pilot/search?q=despacho+105398957&limit=25&offset=50&scope=full&sort=earliest_occurrence_asc",
  );
});

test("recorded-reference client preserves independent scope, lifecycle and pagination", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ observations: [] }) });
  vi.stubGlobal("fetch", fetchMock);
  await lookupRecordedReferences("REF / 123", {
    scope: "full", lifecycle: "include_history", limit: 25, offset: 50,
  });
  expect(fetchMock.mock.calls[0][0]).toBe(
    "/api/consultation/references/lookup?value=REF+%2F+123&scope=full&lifecycle=include_history&limit=25&offset=50",
  );
});
