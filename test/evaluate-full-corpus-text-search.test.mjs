import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateFullCorpusTextSearch,
  rankDistinctBinaries,
} from "../app/evaluate-full-corpus-text-search.mjs";

test("evaluation ranks binaries by their first passage without counting processor duplicates", () => {
  assert.deepEqual(rankDistinctBinaries([
    { sha256: "a" },
    { sha256: "a" },
    { sha256: "b" },
    { sha256: "a" },
    { sha256: "c" },
  ]), ["a", "b", "c"]);
});

test("evaluation uses an explicit passage limit without mutating the fixture", async () => {
  const queryLimits = [];
  const fixture = {
    fixture_name: "test",
    fixture_version: 1,
    passage_limit: 100,
    evaluation_scope: "full",
    success_criterion: { expected_binary_max_distinct_rank: 10, original_must_open: true },
    queries: [{
      id: "explore",
      query: "term",
      category: "keyword",
      expectation_kind: "exploratory",
      expected_sha256s: [],
      ocr_dependency: null,
    }],
  };
  const client = {
    async query(sql, params) {
      if (String(sql).includes("COUNT(*)::int AS total_segments")) {
        return { rows: [{ total_segments: 0, indexed_segments: 0, indexed_representations: 0, indexed_binaries: 0 }] };
      }
      queryLimits.push(params[1]);
      return { rows: [] };
    },
  };
  const result = await evaluateFullCorpusTextSearch(client, {
    fixture,
    passageLimit: 50,
    binaryStore: {},
  });

  assert.equal(result.evaluated_passage_limit, 50);
  assert.equal(fixture.passage_limit, 100);
  assert.deepEqual(queryLimits, [51]);
});
