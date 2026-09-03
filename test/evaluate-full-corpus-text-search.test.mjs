import assert from "node:assert/strict";
import test from "node:test";

import { rankDistinctBinaries } from "../app/evaluate-full-corpus-text-search.mjs";

test("evaluation ranks binaries by their first passage without counting processor duplicates", () => {
  assert.deepEqual(rankDistinctBinaries([
    { sha256: "a" },
    { sha256: "a" },
    { sha256: "b" },
    { sha256: "a" },
    { sha256: "c" },
  ]), ["a", "b", "c"]);
});
