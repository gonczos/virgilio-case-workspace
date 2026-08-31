import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { createConsultationServer } from "../app/consultation-api.mjs";
import {
  assertProcessingSchema,
  getWorkspaceRoot,
  withClient,
} from "../app/processing-common.mjs";
import { listConsultationBinaries } from "../app/consultation-store.mjs";
import {
  getBinaryRowBySha,
  resolveEffectiveRepresentation,
} from "../app/processing-store.mjs";

async function withServer({ client, workspaceRoot }, fn) {
  const server = createConsultationServer({ client, workspaceRoot });
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  try {
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function request(baseUrl, requestPath, { method = "GET" } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(requestPath, baseUrl), { method }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => {
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function withRealClient(fn) {
  return withClient("c4-1-test", async (client) => {
    await assertProcessingSchema(client);
    return fn(client);
  });
}

async function findFixtureBinary(client, { multiDocument = false, withComparison = false } = {}) {
  const result = await client.query(
    `
      SELECT
        fb.sha256,
        COUNT(DISTINCT db.document_id) AS document_count,
        COUNT(DISTINCT cmp.id) AS comparison_count
      FROM casework.file_binary AS fb
      LEFT JOIN casework.document_binary AS db
        ON db.file_binary_id = fb.id
      LEFT JOIN casework.document_representation_comparison AS cmp
        ON cmp.file_binary_id = fb.id
      GROUP BY fb.id, fb.sha256
      HAVING COUNT(DISTINCT db.document_id) ${multiDocument ? ">" : "="} ${multiDocument ? "1" : "1"}
         AND COUNT(DISTINCT cmp.id) ${withComparison ? ">" : ">="} ${withComparison ? "0" : "0"}
      ORDER BY fb.id ASC
      LIMIT 1
    `,
  );
  return result.rows[0]?.sha256 ?? null;
}

async function findRepresentationFixture(client, processorKey) {
  const result = await client.query(
    `
      SELECT dr.id, fb.sha256
      FROM casework.document_representation AS dr
      JOIN casework.file_binary AS fb
        ON fb.id = dr.file_binary_id
      WHERE dr.processor_key = $1
      ORDER BY dr.id ASC
      LIMIT 1
    `,
    [processorKey],
  );
  return result.rows[0] ?? null;
}

test("catalogue endpoint returns known binaries and processing summary", async () => {
  await withRealClient(async (client) => {
    const singleSha = await findFixtureBinary(client, { multiDocument: false });
    assert.ok(singleSha);
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const response = await request(baseUrl, "/api/consultation/binaries?limit=25&offset=0");
      assert.equal(response.statusCode, 200);
      const payload = JSON.parse(response.body);
      assert.equal(Array.isArray(payload.items), true);
      const item = payload.items.find((candidate) => candidate.sha256 === singleSha);
      assert.ok(item);
      assert.equal(typeof item.display_name, "string");
      assert.equal(Array.isArray(item.linked_document_names), true);
      assert.equal(Array.isArray(item.linked_case_refs), true);
      assert.equal(typeof item.document_count, "number");
      assert.equal(typeof item.bucket_count, "number");
      assert.equal(typeof item.case_count, "number");
      assert.equal(typeof item.processing_summary, "object");
      assert.equal(Array.isArray(item.available_representations), true);
      assert.equal(typeof item.review_needed, "boolean");
      assert.equal(Array.isArray(item.review_reason_codes), true);
    });
  });
});

test("catalogue endpoint aggregates a multi-document binary without duplicate counts", async () => {
  await withRealClient(async (client) => {
    const multiSha = await findFixtureBinary(client, { multiDocument: true });
    assert.ok(multiSha);
    const binaryRow = await getBinaryRowBySha(client, multiSha);
    const expected = await client.query(
      `
        SELECT
          COUNT(DISTINCT db.document_id) AS document_count,
          COUNT(DISTINCT b.id) AS bucket_count,
          COUNT(DISTINCT cf.id) AS case_count
        FROM casework.file_binary AS fb
        LEFT JOIN casework.document_binary AS db
          ON db.file_binary_id = fb.id
        LEFT JOIN casework.document AS d
          ON d.id = db.document_id
        LEFT JOIN casework.bucket_document AS bd
          ON bd.document_id = d.id
        LEFT JOIN casework.bucket AS b
          ON b.id = bd.bucket_id
        LEFT JOIN casework.case_file AS cf
          ON cf.id = b.case_file_id
        WHERE fb.id = $1
      `,
      [binaryRow.id],
    );
    const payload = await listConsultationBinaries(client, {
      workspaceRoot: getWorkspaceRoot(),
      limit: 5000,
      offset: 0,
    });
    const item = payload.items.find((candidate) => candidate.sha256 === multiSha);
    assert.ok(item);
    assert.equal(item.document_count, Number(expected.rows[0].document_count));
    assert.equal(item.bucket_count, Number(expected.rows[0].bucket_count));
    assert.equal(item.case_count, Number(expected.rows[0].case_count));
    assert.equal(item.document_count > 1, true);
  });
});

test("detail endpoint resolves a known binary and reuses effective-selection behavior", async () => {
  await withRealClient(async (client) => {
    const comparedSha = await findFixtureBinary(client, { withComparison: true });
    assert.ok(comparedSha);
    const binaryRow = await getBinaryRowBySha(client, comparedSha);
    const expectedSelection = await resolveEffectiveRepresentation(client, { fileBinaryId: binaryRow.id });
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const response = await request(baseUrl, `/api/consultation/binaries/${comparedSha}`);
      assert.equal(response.statusCode, 200);
      const payload = JSON.parse(response.body);
      assert.equal(payload.binary.sha256, comparedSha);
      assert.equal(Array.isArray(payload.context.documents), true);
      assert.equal(Array.isArray(payload.context.buckets), true);
      assert.equal(Array.isArray(payload.context.cases), true);
      assert.equal(Array.isArray(payload.context.workspaces), true);
      assert.equal(Array.isArray(payload.processing.jobs), true);
      assert.equal(Array.isArray(payload.representations.items), true);
      assert.equal(Array.isArray(payload.comparisons), true);
      assert.equal(typeof payload.attention.review_needed, "boolean");
      assert.deepEqual(payload.attention.reason_codes, payload.attention.reasons.map((item) => item.reason_code));
      assert.equal(
        payload.representations.effective?.representation_id ?? null,
        expectedSelection.representation?.id ?? null,
      );
      assert.equal(payload.representations.effective_selection_reason, expectedSelection.selection_source);
    });
  });
});

test("detail endpoint keeps multiple linked documents, buckets, and cases explicit", async () => {
  await withRealClient(async (client) => {
    const multiSha = await findFixtureBinary(client, { multiDocument: true });
    assert.ok(multiSha);
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const response = await request(baseUrl, `/api/consultation/binaries/${multiSha}`);
      assert.equal(response.statusCode, 200);
      const payload = JSON.parse(response.body);
      assert.equal(payload.context.documents.length > 1, true);
      assert.equal(payload.context.buckets.length >= 1, true);
      assert.equal(payload.context.cases.length >= 1, true);
    });
  });
});

test("detail endpoint rejects invalid and unknown sha values safely", async () => {
  await withRealClient(async (client) => {
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const invalid = await request(baseUrl, "/api/consultation/binaries/not-a-sha");
      assert.equal(invalid.statusCode, 400);
      assert.deepEqual(JSON.parse(invalid.body), { error: "invalid_sha256" });

      const missing = await request(baseUrl, "/api/consultation/binaries/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      assert.equal(missing.statusCode, 404);
      assert.deepEqual(JSON.parse(missing.body), { error: "binary_not_found" });
    });
  });
});

test("representation text content returns ordered document_segment text", async () => {
  await withRealClient(async (client) => {
    const fixture = await findRepresentationFixture(client, "docling");
    assert.ok(fixture);
    const expected = await client.query(
      `
        SELECT COALESCE(string_agg(COALESCE(text_content, ''), E'\n' ORDER BY sequence_no), '') AS text_content
        FROM casework.document_segment
        WHERE document_representation_id = $1
      `,
      [fixture.id],
    );
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const response = await request(baseUrl, `/api/consultation/representations/${fixture.id}/content?format=text`);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["content-type"], "text/plain; charset=utf-8");
      assert.equal(response.body, expected.rows[0].text_content);
    });
  });
});

test("representation content returns Docling markdown and reports Xberg markdown unavailable", async () => {
  await withRealClient(async (client) => {
    const docling = await findRepresentationFixture(client, "docling");
    const xberg = await findRepresentationFixture(client, "xberg");
    assert.ok(docling);
    assert.ok(xberg);
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const markdown = await request(baseUrl, `/api/consultation/representations/${docling.id}/content?format=markdown`);
      assert.equal(markdown.statusCode, 200);
      assert.equal(markdown.headers["content-type"], "text/markdown; charset=utf-8");
      assert.equal(markdown.body.length > 0, true);

      const unavailable = await request(baseUrl, `/api/consultation/representations/${xberg.id}/content?format=markdown`);
      assert.equal(unavailable.statusCode, 404);
      assert.deepEqual(JSON.parse(unavailable.body), { error: "representation_format_not_available" });
    });
  });
});

test("representation content returns native JSON for Docling and Xberg", async () => {
  await withRealClient(async (client) => {
    const docling = await findRepresentationFixture(client, "docling");
    const xberg = await findRepresentationFixture(client, "xberg");
    assert.ok(docling);
    assert.ok(xberg);
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const doclingResponse = await request(baseUrl, `/api/consultation/representations/${docling.id}/content?format=native-json`);
      assert.equal(doclingResponse.statusCode, 200);
      assert.equal(doclingResponse.headers["content-type"], "application/json; charset=utf-8");
      const doclingJson = JSON.parse(doclingResponse.body);
      assert.equal(typeof doclingJson, "object");

      const xbergResponse = await request(baseUrl, `/api/consultation/representations/${xberg.id}/content?format=native-json`);
      assert.equal(xbergResponse.statusCode, 200);
      assert.equal(xbergResponse.headers["content-type"], "application/json; charset=utf-8");
      const xbergJson = JSON.parse(xbergResponse.body);
      assert.equal(typeof xbergJson, "object");
    });
  });
});

test("representation content rejects arbitrary paths and does not leak filesystem paths on artifact failures", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-c4-artifacts-"));
  const client = {
    async query(sql, params) {
      if (String(sql).includes("FROM casework.document_representation AS dr")) {
        return {
          rowCount: 1,
          rows: [{
            id: Number(params[0]),
            file_binary_id: 1,
            representation_kind: "extracted_document_bundle",
            format_family: "pdf",
            processor_key: "docling",
            processor_version: "2.123.1",
            representation_source_kind: "machine_generated",
            representation_variant_key: "",
            based_on_representation_id: null,
            produced_by_job_id: 1,
            metadata_json: {},
            content_json: {},
            artifact_rel_path: "../secret",
            created_at: new Date().toISOString(),
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  try {
    await withServer({ client, workspaceRoot: tempRoot }, async (baseUrl) => {
      const invalidFormat = await request(baseUrl, "/api/consultation/representations/123/content?format=../../secret.txt");
      assert.equal(invalidFormat.statusCode, 400);
      assert.deepEqual(JSON.parse(invalidFormat.body), { error: "invalid_representation_format" });

      const invalidPath = await request(baseUrl, "/api/consultation/representations/123/content?format=native-json");
      assert.equal(invalidPath.statusCode, 500);
      assert.deepEqual(JSON.parse(invalidPath.body), { error: "representation_artifact_failed" });
      assert.equal(invalidPath.body.includes("secret"), false);
      assert.equal(invalidPath.body.includes(tempRoot), false);
    });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("consultation endpoint supports HEAD for representation content", async () => {
  await withRealClient(async (client) => {
    const fixture = await findRepresentationFixture(client, "docling");
    assert.ok(fixture);
    await withServer({ client, workspaceRoot: getWorkspaceRoot() }, async (baseUrl) => {
      const response = await request(baseUrl, `/api/consultation/representations/${fixture.id}/content?format=text`, {
        method: "HEAD",
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body, "");
      assert.equal(response.headers["content-type"], "text/plain; charset=utf-8");
    });
  });
});
