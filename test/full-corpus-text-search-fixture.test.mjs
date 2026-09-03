import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const fixturePath = new URL("./fixtures/full-corpus-text-search-evaluation.json", import.meta.url);

test("full-corpus search fixture freezes bounded, independently assessable expectations", async () => {
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  assert.equal(fixture.evaluation_scope, "full");
  assert.equal(fixture.success_criterion.expected_binary_max_distinct_rank, 10);
  assert.equal(fixture.success_criterion.original_must_open, true);
  assert.ok(fixture.queries.length >= 10 && fixture.queries.length <= 15);

  const known = fixture.queries.filter((item) => item.expectation_kind === "known_target");
  const exploratory = fixture.queries.filter((item) => item.expectation_kind === "exploratory");
  assert.ok(known.length > 0);
  assert.ok(exploratory.length > 0);
  assert.ok(known.every((item) => item.expected_sha256s.length > 0));
  assert.ok(exploratory.every((item) => item.expected_sha256s.length === 0));
  assert.ok(known.some((item) => item.ocr_dependency === true));
  assert.ok(fixture.queries.some((item) => item.category === "quoted_text"));
  assert.equal(new Set(fixture.queries.map((item) => item.id)).size, fixture.queries.length);
});
