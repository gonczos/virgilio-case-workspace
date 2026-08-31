import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import {
  assertProcessingSchema,
  getWorkspaceRoot,
  withClient,
} from "../app/processing-common.mjs";
import {
  getRepresentationContent,
} from "../app/consultation-store.mjs";
import {
  isRepresentationArtifactError,
} from "../app/representation-artifacts.mjs";
import {
  DOCLING_PROCESSOR_VERSION,
  XBERG_PROCESSOR_VERSION,
} from "../app/processing-registry.mjs";
import {
  enqueueJobsForBinary,
  getBinaryRowById,
} from "../app/processing-store.mjs";

const execFile = promisify(execFileCallback);

const PROJECT_PYTHON = path.join(getWorkspaceRoot(), ".venv-processing", "Scripts", "python.exe");
const EXTRACTOR_PATH = path.join(getWorkspaceRoot(), "app", "processors", "extract-document.py");

async function runExtractorModuleSnippet(code) {
  const python = [
    "import importlib.util, json",
    `spec = importlib.util.spec_from_file_location('extract_document', r'''${EXTRACTOR_PATH}''')`,
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    code,
  ].join("\n");
  const result = await execFile(PROJECT_PYTHON, ["-c", python], {
    cwd: getWorkspaceRoot(),
    windowsHide: true,
  });
  return JSON.parse(result.stdout);
}

async function withRollbackDb(fn) {
  return withClient("phase-c5.2-test", async (client) => {
    await assertProcessingSchema(client);
    await client.query("BEGIN");
    try {
      const fixtureBinary = (await client.query(
        `
          SELECT id, sha256
          FROM casework.file_binary
          ORDER BY id ASC
          LIMIT 1
        `,
      )).rows[0];
      const result = await fn(client, fixtureBinary);
      await client.query("ROLLBACK");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

test("Docling helper preserves body-only markdown and separate complete text with furniture", async () => {
  const payload = await runExtractorModuleSnippet(`
class FakeDocument:
    def export_to_text(self, included_content_layers=None):
        labels = sorted(layer.name for layer in included_content_layers)
        return "TEXT:" + ",".join(labels)

    def export_to_markdown(self, included_content_layers=None):
        labels = sorted(layer.name for layer in included_content_layers)
        return "MARKDOWN:" + ",".join(labels)

print(json.dumps(module.build_docling_projections(FakeDocument())))
`);
  assert.deepEqual(payload, {
    text_content: "TEXT:BODY",
    complete_text_content: "TEXT:BODY,FURNITURE",
    markdown_content: "MARKDOWN:BODY",
  });
});

test("Xberg helper uses explicit preservation-oriented content filter", async () => {
  const payload = await runExtractorModuleSnippet(`
config = module.build_xberg_config("never")
content_filter = config["content_filter"]
print(json.dumps({
    "include_headers": content_filter.include_headers,
    "include_footers": content_filter.include_footers,
    "strip_repeating_text": content_filter.strip_repeating_text,
    "include_watermarks": content_filter.include_watermarks,
    "disable_ocr": config.get("disable_ocr", False),
    "has_force_ocr": "force_ocr" in config,
}))
`);
  assert.deepEqual(payload, {
    include_headers: true,
    include_footers: true,
    strip_repeating_text: false,
    include_watermarks: false,
    disable_ocr: true,
    has_force_ocr: false,
  });
});

test("complete-text artifact is accessible when retained and older representations without it remain valid", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-c5.2-artifacts-"));
  const artifactRelPath = path.join("data", "exports", "processing", "docling", "test-version", "fixture").replace(/\\/gu, "/");
  const artifactAbsPath = path.join(tempRoot, artifactRelPath);
  await fs.mkdir(artifactAbsPath, { recursive: true });
  await fs.writeFile(path.join(artifactAbsPath, "markdown.md"), "# Body only\n", "utf8");
  await fs.writeFile(path.join(artifactAbsPath, "native.json"), "{\n  \"ok\": true\n}\n", "utf8");
  await fs.writeFile(path.join(artifactAbsPath, "complete-text.txt"), "Body\nHeader\nFooter\n", "utf8");

  const fakeClient = {
    async query(sql, params) {
      if (!String(sql).includes("FROM casework.document_representation AS dr")) {
        throw new Error(`Unexpected query: ${sql}`);
      }
      const representationId = Number(params[0]);
      if (representationId === 1) {
        return {
          rowCount: 1,
          rows: [{
            id: 1,
            artifact_rel_path: artifactRelPath,
          }],
        };
      }
      if (representationId === 2) {
        return {
          rowCount: 1,
          rows: [{
            id: 2,
            artifact_rel_path: artifactRelPath.replace("fixture", "old-fixture"),
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    },
  };
  try {
    const complete = await getRepresentationContent(fakeClient, 1, "complete-text", { workspaceRoot: tempRoot });
    assert.equal(complete.contentType, "text/plain; charset=utf-8");
    assert.equal(complete.body, "Body\nHeader\nFooter\n");

    await fs.mkdir(path.join(tempRoot, artifactRelPath.replace("fixture", "old-fixture")), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, artifactRelPath.replace("fixture", "old-fixture"), "markdown.md"),
      "# Historical body text\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(tempRoot, artifactRelPath.replace("fixture", "old-fixture"), "native.json"),
      "{\n  \"historical\": true\n}\n",
      "utf8",
    );
    await assert.rejects(
      () => getRepresentationContent(fakeClient, 2, "complete-text", { workspaceRoot: tempRoot }),
      (error) => {
        assert.equal(isRepresentationArtifactError(error), true);
        assert.equal(error.code, "representation_format_not_available");
        return true;
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("current C5.2 processor identities do not treat older successful representations as already satisfied", async () => {
  await withRollbackDb(async (client, binary) => {
    const oldDoclingJob = (await client.query(
      `
        INSERT INTO casework.processing_job (
          stage_key,
          status,
          file_binary_id,
          processor_key,
          processor_version,
          requested_by,
          requested_at,
          started_at,
          completed_at,
          attempt_count,
          max_attempts
        )
        VALUES ('EXTRACT_STRUCTURE', 'completed', $1, 'docling', '2.123.1', 'phase-c5.2-test', NOW(), NOW(), NOW(), 1, 1)
        RETURNING id
      `,
      [binary.id],
    )).rows[0];
    await client.query(
      `
        INSERT INTO casework.document_representation (
          file_binary_id,
          produced_by_job_id,
          representation_kind,
          format_family,
          processor_key,
          processor_version,
          representation_source_kind,
          representation_variant_key,
          metadata_json,
          content_json,
          artifact_rel_path
        )
        VALUES ($1, $2, 'extracted_document_bundle', 'pdf', 'docling', '2.123.1', 'machine_generated', '', '{}'::jsonb, '{}'::jsonb, NULL)
      `,
      [binary.id, oldDoclingJob.id],
    );
    const oldXbergJob = (await client.query(
      `
        INSERT INTO casework.processing_job (
          stage_key,
          status,
          file_binary_id,
          processor_key,
          processor_version,
          requested_by,
          requested_at,
          started_at,
          completed_at,
          attempt_count,
          max_attempts
        )
        VALUES ('EXTRACT_STRUCTURE', 'completed', $1, 'xberg', '1.0.14', 'phase-c5.2-test', NOW(), NOW(), NOW(), 1, 1)
        RETURNING id
      `,
      [binary.id],
    )).rows[0];
    await client.query(
      `
        INSERT INTO casework.document_representation (
          file_binary_id,
          produced_by_job_id,
          representation_kind,
          format_family,
          processor_key,
          processor_version,
          representation_source_kind,
          representation_variant_key,
          metadata_json,
          content_json,
          artifact_rel_path
        )
        VALUES ($1, $2, 'extracted_document_bundle', 'pdf', 'xberg', '1.0.14', 'machine_generated', '', '{}'::jsonb, '{}'::jsonb, NULL)
      `,
      [binary.id, oldXbergJob.id],
    );

    const results = await enqueueJobsForBinary(client, await getBinaryRowById(client, binary.id), {
      requestedBy: "phase-c5.2-test",
    });
    assert.ok(results.some((item) => (
      item.processor_key === "docling"
      && item.action === "enqueued"
      && item.processor_version === DOCLING_PROCESSOR_VERSION
    )));
    assert.ok(results.some((item) => (
      item.processor_key === "xberg"
      && item.action === "enqueued"
      && item.processor_version === XBERG_PROCESSOR_VERSION
    )));
  });
});
