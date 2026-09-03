import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { LocalBinaryStore } from "./binary-store.mjs";
import { getWorkspaceRoot, withClient } from "./processing-common.mjs";
import { searchReferencePilot } from "./reference-index-pilot.mjs";

const workspaceRoot = getWorkspaceRoot();
const fixturePath = path.join(
  workspaceRoot,
  "test",
  "fixtures",
  "full-corpus-text-search-evaluation.json",
);

export function rankDistinctBinaries(items) {
  return [...new Set(items.map((item) => item.sha256))];
}

async function checkOriginal(binaryStore, client, sha256) {
  const result = await client.query(`
    SELECT id, sha256, storage_package_id, storage_rel_path, actual_size_bytes
    FROM casework.file_binary
    WHERE sha256 = $1
  `, [sha256]);
  if (result.rows.length !== 1) return false;
  try {
    const materialized = await binaryStore.materialize(result.rows[0]);
    await materialized.release();
    return true;
  } catch {
    return false;
  }
}

export async function evaluateFullCorpusTextSearch(client, {
  fixture = null,
  binaryStore = new LocalBinaryStore({ workspaceRoot }),
} = {}) {
  const evaluationFixture = fixture
    ?? JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const maximumRank = evaluationFixture.success_criterion.expected_binary_max_distinct_rank;
  const coverageResult = await client.query(`
    SELECT COUNT(*)::int AS total_segments,
           COUNT(*) FILTER (WHERE search_vector IS NOT NULL)::int AS indexed_segments,
           COUNT(DISTINCT document_representation_id)
             FILTER (WHERE search_vector IS NOT NULL)::int AS indexed_representations,
           COUNT(DISTINCT dr.file_binary_id)
             FILTER (WHERE ds.search_vector IS NOT NULL)::int AS indexed_binaries
    FROM casework.document_segment ds
    JOIN casework.document_representation dr ON dr.id = ds.document_representation_id
  `);
  const results = [];

  for (const evaluationQuery of evaluationFixture.queries) {
    const startedAt = performance.now();
    const response = await searchReferencePilot(client, evaluationQuery.query, {
      limit: evaluationFixture.passage_limit,
      scope: evaluationFixture.evaluation_scope,
    });
    const latencyMs = Math.round((performance.now() - startedAt) * 10) / 10;
    const distinctBinaries = rankDistinctBinaries(response.items);
    const expected = [];
    for (const sha256 of evaluationQuery.expected_sha256s) {
      const index = distinctBinaries.indexOf(sha256);
      const rank = index < 0 ? null : index + 1;
      expected.push({
        sha256,
        distinct_binary_rank: rank,
        within_rank_threshold: rank !== null && rank <= maximumRank,
        original_binary_readable: await checkOriginal(binaryStore, client, sha256),
        binary_detail_path: `/binaries/${sha256}`,
      });
    }
    const counted = evaluationQuery.expectation_kind === "known_target";
    results.push({
      id: evaluationQuery.id,
      query: evaluationQuery.query,
      category: evaluationQuery.category,
      expectation_kind: evaluationQuery.expectation_kind,
      ocr_dependency: evaluationQuery.ocr_dependency,
      latency_ms: latencyMs,
      result_summary: response.result_summary,
      expected,
      automated_pass: counted
        ? expected.every((item) => item.within_rank_threshold && item.original_binary_readable)
        : null,
    });
  }

  const countedResults = results.filter((item) => item.automated_pass !== null);
  return {
    fixture_name: evaluationFixture.fixture_name,
    fixture_version: evaluationFixture.fixture_version,
    evaluated_at: new Date().toISOString(),
    success_criterion: evaluationFixture.success_criterion,
    index_coverage: coverageResult.rows[0],
    summary: {
      counted_queries: countedResults.length,
      passed_queries: countedResults.filter((item) => item.automated_pass).length,
      exploratory_queries: results.filter((item) => item.automated_pass === null).length,
      all_counted_queries_passed: countedResults.every((item) => item.automated_pass),
      original_ui_opening_requires_manual_review: true,
    },
    results,
  };
}

async function main() {
  await withClient("evaluate-full-corpus-text-search", async (client) => {
    console.log(JSON.stringify(await evaluateFullCorpusTextSearch(client), null, 2));
  });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
