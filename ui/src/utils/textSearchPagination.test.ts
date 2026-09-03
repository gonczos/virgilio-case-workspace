import { expect, test } from "vitest";

import type { ReferenceTextHit } from "../types/consultation";
import { groupReferenceTextHits } from "./consultation";
import { mergeTextSearchHits } from "./textSearchPagination";

function hit(segmentId: number, sha256: string, processorKey: string): ReferenceTextHit {
  return {
    segment_id: segmentId,
    document_representation_id: segmentId,
    file_binary_id: segmentId,
    sha256,
    representation_kind: "extracted_document_bundle",
    processor_key: processorKey,
    processor_version: "test",
    segment_kind: "document",
    sequence_no: 0,
    page_no: null,
    location_kind: "document_level",
    location: { kind: "document_level", pdf_page: null },
    rank: 1,
    headline: "match",
    source_contexts: [],
    passage_reference_observations: [],
    contextual_reference_observations: [],
  };
}

test("later pages deduplicate passages and extend an existing binary group", () => {
  const sha = "a".repeat(64);
  const merged = mergeTextSearchHits(
    [hit(1, sha, "docling")],
    [hit(1, sha, "docling"), hit(2, sha, "xberg"), hit(3, "b".repeat(64), "docling")],
  );
  const groups = groupReferenceTextHits(merged);

  expect(merged.map((item) => item.segment_id)).toEqual([1, 2, 3]);
  expect(groups).toHaveLength(2);
  expect(groups[0].hits.map((item) => item.processor_key)).toEqual(["docling", "xberg"]);
});
