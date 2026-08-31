import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  BinaryStoreError,
  LocalBinaryStore,
} from "../app/binary-store.mjs";
import {
  DEFAULT_SELECTION_PURPOSE,
  QUICK_PREVIEW_PURPOSE,
  assertProcessingSchema,
  getWorkspaceRoot,
  resolveBinaryPath,
  withClient,
} from "../app/processing-common.mjs";
import {
  buildComparisonObservation,
  canonicalizeComparisonPair,
} from "../app/processing-comparison.mjs";
import { determineProcessingPolicy } from "../app/processing-registry.mjs";
import {
  claimNextJob,
  clearSelectionOverride,
  countProcessingState,
  deriveRepresentationAttention,
  enqueueJobsForBinary,
  getBinaryRowById,
  processOneJob,
  recoverRunningJobs,
  resolveEffectiveRepresentation,
  upsertSelectionOverride,
} from "../app/processing-store.mjs";

async function withRollbackDb(fn) {
  return withClient("phase-c3-test", async (client) => {
    await assertProcessingSchema(client);
    await client.query("BEGIN");
    try {
      const fixtureBinary = (await client.query(
        `
          SELECT id, sha256, mime_type, file_extension, machine_readability_status
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

function dbTest(name, fn) {
  test(name, { concurrency: false }, fn);
}

async function insertJob(client, {
  fileBinaryId,
  processorKey,
  processorVersion,
  status = "completed",
  stageKey = "EXTRACT_STRUCTURE",
  documentRepresentationId = null,
  requestedBy = "phase-c3-test",
  dependsOnJobId = null,
  attemptCount = 1,
  maxAttempts = 3,
  startedAtExpr = "NOW()",
  completedAtExpr = status === "queued" || status === "running" ? "NULL" : "NOW()",
}) {
  const result = await client.query(
    `
      INSERT INTO casework.processing_job (
        stage_key,
        status,
        file_binary_id,
        document_representation_id,
        processor_key,
        processor_version,
        requested_by,
        requested_at,
        started_at,
        completed_at,
        attempt_count,
        max_attempts,
        depends_on_job_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), ${startedAtExpr}, ${completedAtExpr}, $8, $9, $10)
      RETURNING *
    `,
    [
      stageKey,
      status,
      fileBinaryId,
      documentRepresentationId,
      processorKey,
      processorVersion,
      requestedBy,
      attemptCount,
      maxAttempts,
      dependsOnJobId,
    ],
  );
  return result.rows[0];
}

async function insertRepresentation(client, {
  fileBinaryId,
  producedByJobId,
  processorKey,
  processorVersion,
  representationSourceKind = "machine_generated",
  representationVariantKey = "",
  basedOnRepresentationId = null,
  createdAtExpr = "NOW()",
}) {
  const result = await client.query(
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
        based_on_representation_id,
        metadata_json,
        content_json,
        artifact_rel_path,
        created_at
      )
      VALUES ($1, $2, 'extracted_document_bundle', 'pdf', $3, $4, $5, $6, $7, '{}'::jsonb, '{}'::jsonb, NULL, ${createdAtExpr})
      RETURNING *
    `,
    [
      fileBinaryId,
      producedByJobId,
      processorKey,
      processorVersion,
      representationSourceKind,
      representationVariantKey,
      basedOnRepresentationId,
    ],
  );
  const representation = result.rows[0];
  await client.query(
    `
      INSERT INTO casework.document_segment (
        document_representation_id,
        segment_kind,
        sequence_no,
        text_content,
        metadata_json
      )
      VALUES ($1, 'document_text', 1, $2, '{}'::jsonb)
    `,
    [representation.id, `${processorKey}-${processorVersion}-text`],
  );
  return representation;
}

test("determineProcessingPolicy selects both PDF engines and plain-text passthrough only for text files", async () => {
  const pdf = determineProcessingPolicy({
    mime_type: "application/pdf",
    file_extension: ".pdf",
    machine_readability_status: "text_pdf",
  }).map((item) => item.key);
  const text = determineProcessingPolicy({
    mime_type: "text/plain",
    file_extension: ".txt",
    machine_readability_status: null,
  }).map((item) => item.key);
  assert.deepEqual(pdf, ["docling", "xberg"]);
  assert.deepEqual(text, ["plain_text_passthrough"]);
});

test("comparison remains processor-agnostic and preserves disagreement", async () => {
  assert.deepEqual(canonicalizeComparisonPair(9, 3), [3, 9]);
  const observation = buildComparisonObservation({
    leftLabel: "left",
    rightLabel: "right",
    leftText: "Processo 824/13.7T8SNT-A",
    rightText: "Processo 824/13.7TBSNT-A",
  });
  assert.equal(observation.disagreement_level, "high");
  assert.equal(observation.exact_normalized_match, false);
});

dbTest("LocalBinaryStore materializes the canonical local path without duplicating the file", async () => {
  await withRollbackDb(async (client, binary) => {
    const binaryRow = await getBinaryRowById(client, binary.id);
    const binaryStore = new LocalBinaryStore({ workspaceRoot: getWorkspaceRoot() });
    const materialized = await binaryStore.materialize(binaryRow);
    try {
      assert.equal(materialized.localPath, resolveBinaryPath(getWorkspaceRoot(), binaryRow));
      assert.equal(materialized.materializationKind, "canonical_local_path");
      assert.equal(materialized.isTemporary, false);
      const verified = await binaryStore.verify(binaryRow, { verifySha256: true });
      assert.equal(verified.verified, true);
      assert.equal(verified.sha256Verified, true);
    } finally {
      await materialized.release();
    }
  });
});

test("LocalBinaryStore reports a missing canonical binary explicitly", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-bstore-"));
  const binaryStore = new LocalBinaryStore({ workspaceRoot: tempRoot });
  const binaryRow = {
    id: 999001,
    sha256: "0".repeat(64),
    storage_package_id: "missing-package",
    storage_rel_path: "missing/file.pdf",
    actual_size_bytes: 12,
  };
  try {
    await assert.rejects(
      () => binaryStore.materialize(binaryRow),
      (error) => {
        assert.equal(error instanceof BinaryStoreError, true);
        assert.equal(error.code, "binary_missing");
        return true;
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

dbTest("automatic selection prefers docling over xberg for consultation_default", async () => {
  await withRollbackDb(async (client, binary) => {
    const xbergJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "xberg",
      processorVersion: "1.0.14",
    });
    const xbergRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: xbergJob.id,
      processorKey: "xberg",
      processorVersion: "1.0.14",
    });
    const doclingJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    const doclingRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: doclingJob.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });

    const resolved = await resolveEffectiveRepresentation(client, {
      fileBinaryId: binary.id,
      purpose: DEFAULT_SELECTION_PURPOSE,
    });
    assert.equal(resolved.selection_source, "automatic_policy");
    assert.equal(resolved.representation.id, doclingRepresentation.id);
    assert.notEqual(resolved.representation.id, xbergRepresentation.id);
  });
});

dbTest("quick preview uses xberg when docling is not the quick-preview preference", async () => {
  await withRollbackDb(async (client, binary) => {
    const xbergJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "xberg",
      processorVersion: "1.0.14",
    });
    const xbergRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: xbergJob.id,
      processorKey: "xberg",
      processorVersion: "1.0.14",
    });
    const doclingJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: doclingJob.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });

    const resolved = await resolveEffectiveRepresentation(client, {
      fileBinaryId: binary.id,
      purpose: QUICK_PREVIEW_PURPOSE,
    });
    assert.equal(resolved.representation.id, xbergRepresentation.id);
  });
});

dbTest("human representation does not automatically override machine selection, but can be explicitly selected", async () => {
  await withRollbackDb(async (client, binary) => {
    const doclingJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    const doclingRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: doclingJob.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    const humanJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "human",
      processorVersion: "manual-v1",
      stageKey: "HUMAN_CREATE_REPRESENTATION",
      requestedBy: "reviewer",
    });
    const humanRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: humanJob.id,
      processorKey: "human",
      processorVersion: "manual-v1",
      representationSourceKind: "human_authored",
      representationVariantKey: "human-a",
    });
    const automatic = await resolveEffectiveRepresentation(client, {
      fileBinaryId: binary.id,
      purpose: DEFAULT_SELECTION_PURPOSE,
    });
    assert.equal(automatic.representation.id, doclingRepresentation.id);

    await upsertSelectionOverride(client, {
      fileBinaryId: binary.id,
      representationId: humanRepresentation.id,
      selectedBy: "reviewer@example.test",
      selectionNote: "manual override",
    });
    const explicit = await resolveEffectiveRepresentation(client, {
      fileBinaryId: binary.id,
      purpose: DEFAULT_SELECTION_PURPOSE,
    });
    assert.equal(explicit.selection_source, "explicit_human_selection");
    assert.equal(explicit.representation.id, humanRepresentation.id);
  });
});

dbTest("explicit selection remains stable when a newer representation appears, and clearing it restores automatic behavior", async () => {
  await withRollbackDb(async (client, binary) => {
    const xbergJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "xberg",
      processorVersion: "1.0.14",
    });
    const xbergRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: xbergJob.id,
      processorKey: "xberg",
      processorVersion: "1.0.14",
      createdAtExpr: "NOW() - INTERVAL '2 minutes'",
    });
    await upsertSelectionOverride(client, {
      fileBinaryId: binary.id,
      representationId: xbergRepresentation.id,
      selectedBy: "reviewer",
    });
    const doclingJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    const doclingRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: doclingJob.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
      createdAtExpr: "NOW()",
    });
    const explicit = await resolveEffectiveRepresentation(client, {
      fileBinaryId: binary.id,
    });
    assert.equal(explicit.representation.id, xbergRepresentation.id);
    const attention = await deriveRepresentationAttention(client, binary.id);
    assert.equal(attention.review_needed, true);

    await clearSelectionOverride(client, { fileBinaryId: binary.id });
    const automatic = await resolveEffectiveRepresentation(client, {
      fileBinaryId: binary.id,
    });
    assert.equal(automatic.representation.id, doclingRepresentation.id);
  });
});

dbTest("attention state remains visible for human representation and disagreement", async () => {
  await withRollbackDb(async (client, binary) => {
    const doclingJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    const doclingRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: doclingJob.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    const humanJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "human",
      processorVersion: "manual-v1",
      stageKey: "HUMAN_CREATE_REPRESENTATION",
      requestedBy: "reviewer",
    });
    const humanRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: humanJob.id,
      processorKey: "human",
      processorVersion: "manual-v1",
      representationSourceKind: "human_authored",
      representationVariantKey: "human-b",
      basedOnRepresentationId: doclingRepresentation.id,
    });
    await client.query(
      `
        INSERT INTO casework.document_representation_comparison (
          file_binary_id,
          representation_a_id,
          representation_b_id,
          comparison_kind,
          comparator_key,
          comparator_version,
          summary_json
        )
        VALUES ($1, $2, $3, 'normalized_text', 'test', 'v1', $4::jsonb)
      `,
      [
        binary.id,
        Math.min(doclingRepresentation.id, humanRepresentation.id),
        Math.max(doclingRepresentation.id, humanRepresentation.id),
        JSON.stringify({ disagreement_level: "high" }),
      ],
    );
    const attention = await deriveRepresentationAttention(client, binary.id);
    assert.equal(attention.review_needed, true);
    assert.ok(attention.reasons.some((item) => item.reason_code === "human_representation_present"));
    assert.ok(attention.reasons.some((item) => item.reason_code === "representation_disagreement"));
  });
});

dbTest("claimNextJob allows only one concurrent claimant for the same queued job", async () => {
  await withClient("phase-c3-test-claim-setup", async (client) => {
    await assertProcessingSchema(client);
    const binary = (await client.query(
      `
        SELECT id
        FROM casework.file_binary
        ORDER BY id ASC
        LIMIT 1
      `,
    )).rows[0];
    const created = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "claim_test_processor",
      processorVersion: "v1",
      status: "queued",
      attemptCount: 0,
      startedAtExpr: "NULL",
      completedAtExpr: "NULL",
      requestedBy: "phase-c3-test-claim",
    });
    try {
      const claimed = await Promise.all([
        withClient("phase-c3-test-claim-a", async (claimClient) => claimNextJob(claimClient)),
        withClient("phase-c3-test-claim-b", async (claimClient) => claimNextJob(claimClient)),
      ]);
      const matchingClaims = claimed.filter((row) => row?.id === created.id);
      assert.equal(matchingClaims.length, 1);
    } finally {
      await client.query(
        `
          DELETE FROM casework.processing_job
          WHERE requested_by = 'phase-c3-test-claim'
        `,
      );
    }
  });
});

dbTest("processOneJob obtains the binary through BinaryStore and passes a local path to the processor", async () => {
  await withClient("phase-c3-test-binary-store-success", async (client) => {
    await assertProcessingSchema(client);
    const binary = (await client.query(
      `
        SELECT id
        FROM casework.file_binary
        ORDER BY id ASC
        LIMIT 1
      `,
    )).rows[0];
    await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "mock_store_success",
      processorVersion: "v1",
      status: "queued",
      attemptCount: 0,
      startedAtExpr: "NULL",
      completedAtExpr: "NULL",
    });
    const events = [];
    const mockRegistry = [
      {
        key: "mock_store_success",
        version: "v1",
        representationKind: "extracted_document_bundle",
        supportsBinary() {
          return true;
        },
        async execute({ binaryRow, materializedBinary }) {
          events.push({
            binaryId: binaryRow.id,
            localPath: materializedBinary.localPath,
            materializationKind: materializedBinary.materializationKind,
          });
          return {
            processorKey: "mock_store_success",
            processorVersion: "v1",
            representationKind: "extracted_document_bundle",
            formatFamily: "pdf",
            artifactRelPath: null,
            metadataJson: { mock: true },
            contentJson: { text_length: 4 },
            segments: [
              {
                segment_kind: "document_text",
                sequence_no: 1,
                text_content: "mock",
                structural_path: null,
                page_no: null,
                char_start: 0,
                char_end: 4,
                metadata_json: { source: "mock" },
              },
            ],
          };
        },
      },
    ];
    const mockBinaryStore = {
      async materialize(binaryRow) {
        events.push({ stage: "materialize", binaryId: binaryRow.id });
        return {
          localPath: `C:/synthetic/${binaryRow.sha256}.bin`,
          materializationKind: "test_materialization",
          isTemporary: true,
          async release() {
            events.push({ stage: "release", binaryId: binaryRow.id });
          },
        };
      },
    };
    try {
      const result = await processOneJob(client, {
        registry: mockRegistry,
        binaryStore: mockBinaryStore,
      });
      assert.equal(result.status, "completed");
      assert.deepEqual(events, [
        { stage: "materialize", binaryId: binary.id },
        {
          binaryId: binary.id,
          localPath: `C:/synthetic/${(await getBinaryRowById(client, binary.id)).sha256}.bin`,
          materializationKind: "test_materialization",
        },
        { stage: "release", binaryId: binary.id },
      ]);
    } finally {
      await client.query(
        `
          DELETE FROM casework.document_representation_comparison
          WHERE representation_a_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.processor_key = 'mock_store_success'
          )
          OR representation_b_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.processor_key = 'mock_store_success'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.document_segment
          WHERE document_representation_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.processor_key = 'mock_store_success'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.document_representation
          WHERE produced_by_job_id IN (
            SELECT id
            FROM casework.processing_job
            WHERE processor_key = 'mock_store_success'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.processing_job
          WHERE processor_key = 'mock_store_success'
        `,
      );
    }
  });
});

dbTest("processOneJob releases the claim transaction before binary materialization and extraction", async () => {
  await withClient("phase-c3-test-claim-release", async (client) => {
    await assertProcessingSchema(client);
    const binary = (await client.query(
      `
        SELECT id, sha256
        FROM casework.file_binary
        ORDER BY id ASC
        LIMIT 1
      `,
    )).rows[0];
    const createdJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "mock_claim_release",
      processorVersion: "v1",
      status: "queued",
      attemptCount: 0,
      startedAtExpr: "NULL",
      completedAtExpr: "NULL",
    });
    const registry = [
      {
        key: "mock_claim_release",
        version: "v1",
        representationKind: "extracted_document_bundle",
        supportsBinary() {
          return true;
        },
        async execute() {
          return {
            processorKey: "mock_claim_release",
            processorVersion: "v1",
            representationKind: "extracted_document_bundle",
            formatFamily: "pdf",
            artifactRelPath: null,
            metadataJson: { mock: true },
            contentJson: { text_length: 4 },
            segments: [
              {
                segment_kind: "document_text",
                sequence_no: 1,
                text_content: "lock",
                structural_path: null,
                page_no: null,
                char_start: 0,
                char_end: 4,
                metadata_json: { source: "mock" },
              },
            ],
          };
        },
      },
    ];
    const lockCheck = [];
    const binaryStore = {
      async materialize(binaryRow) {
        const observedStatus = await withClient("phase-c3-test-claim-release-status", async (checkClient) => {
          const row = (await checkClient.query(
            `
              SELECT status
              FROM casework.processing_job
              WHERE id = $1
            `,
            [createdJob.id],
          )).rows[0];
          return row?.status ?? null;
        });
        lockCheck.push(observedStatus);
        await withClient("phase-c3-test-claim-release-lock", async (lockClient) => {
          await lockClient.query("BEGIN");
          try {
            await lockClient.query("SET LOCAL lock_timeout = '500ms'");
            await lockClient.query(
              `
                UPDATE casework.processing_job
                SET requested_by = requested_by
                WHERE id = $1
              `,
              [createdJob.id],
            );
            await lockClient.query("COMMIT");
          } catch (error) {
            await lockClient.query("ROLLBACK");
            throw error;
          }
        });
        return {
          localPath: `C:/synthetic/${binaryRow.sha256}.bin`,
          materializationKind: "test_materialization",
          isTemporary: true,
          async release() {},
        };
      },
    };
    try {
      const result = await processOneJob(client, {
        registry,
        binaryStore,
      });
      assert.equal(result.status, "completed");
      assert.deepEqual(lockCheck, ["running"]);
    } finally {
      await client.query(
        `
          DELETE FROM casework.document_representation_comparison
          WHERE representation_a_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.processor_key = 'mock_claim_release'
          )
          OR representation_b_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.processor_key = 'mock_claim_release'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.document_segment
          WHERE document_representation_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.processor_key = 'mock_claim_release'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.document_representation
          WHERE produced_by_job_id IN (
            SELECT id
            FROM casework.processing_job
            WHERE processor_key = 'mock_claim_release'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.processing_job
          WHERE processor_key = 'mock_claim_release'
        `,
      );
    }
  });
});

dbTest("processOneJob completes through a mock processor and persists comparison-safe representations", async () => {
  await withClient("phase-c3-test-process-complete", async (client) => {
    await assertProcessingSchema(client);
    const binary = (await client.query(
      `
        SELECT id
        FROM casework.file_binary
        ORDER BY id ASC
        LIMIT 1
      `,
    )).rows[0];
    await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "mock_complete",
      processorVersion: "v1",
      status: "queued",
      attemptCount: 0,
      startedAtExpr: "NULL",
      completedAtExpr: "NULL",
    });
    const mockRegistry = [
      {
        key: "mock_complete",
        version: "v1",
        representationKind: "extracted_document_bundle",
        supportsBinary() {
          return true;
        },
        async execute() {
          return {
            processorKey: "mock_complete",
            processorVersion: "v1",
            representationKind: "extracted_document_bundle",
            formatFamily: "pdf",
            artifactRelPath: null,
            metadataJson: { mock: true },
            contentJson: { text_length: 4 },
            segments: [
              {
                segment_kind: "document_text",
                sequence_no: 1,
                text_content: "mock",
                structural_path: null,
                page_no: null,
                char_start: 0,
                char_end: 4,
                metadata_json: { source: "mock" },
              },
            ],
          };
        },
      },
    ];
    try {
      const result = await processOneJob(client, { registry: mockRegistry });
      assert.equal(result.status, "completed");
      const counts = await countProcessingState(client);
      assert.equal(Number(counts.representation_count) >= 1, true);
    } finally {
      await client.query(
        `
          DELETE FROM casework.document_representation_comparison
          WHERE representation_a_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.requested_by = 'phase-c3-test'
          )
          OR representation_b_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.requested_by = 'phase-c3-test'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.document_segment
          WHERE document_representation_id IN (
            SELECT dr.id
            FROM casework.document_representation AS dr
            JOIN casework.processing_job AS pj
              ON pj.id = dr.produced_by_job_id
            WHERE pj.requested_by = 'phase-c3-test'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.document_representation
          WHERE produced_by_job_id IN (
            SELECT id
            FROM casework.processing_job
            WHERE requested_by = 'phase-c3-test'
          )
        `,
      );
      await client.query(
        `
          DELETE FROM casework.processing_job
          WHERE requested_by = 'phase-c3-test'
        `,
      );
    }
  });
});

dbTest("processOneJob persists explicit binary-store failure without invoking the processor", async () => {
  await withClient("phase-c3-test-process-store-failure", async (client) => {
    await assertProcessingSchema(client);
    const binary = (await client.query(
      `
        SELECT id
        FROM casework.file_binary
        ORDER BY id ASC
        LIMIT 1
      `,
    )).rows[0];
    await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "mock_store_fail",
      processorVersion: "v1",
      status: "queued",
      attemptCount: 0,
      maxAttempts: 1,
      startedAtExpr: "NULL",
      completedAtExpr: "NULL",
    });
    let executeCalled = false;
    const registry = [
      {
        key: "mock_store_fail",
        version: "v1",
        representationKind: "extracted_document_bundle",
        supportsBinary() {
          return true;
        },
        async execute() {
          executeCalled = true;
          throw new Error("processor should not run after binary-store failure");
        },
      },
    ];
    const failingBinaryStore = {
      async materialize(binaryRow) {
        throw new BinaryStoreError(
          "binary_missing",
          `Synthetic missing binary for file_binary ${binaryRow.id}`,
        );
      },
    };
    try {
      const failure = await processOneJob(client, {
        registry,
        binaryStore: failingBinaryStore,
      });
      assert.equal(failure.status, "failed");
      assert.equal(executeCalled, false);
      const failedRow = (await client.query(
        `
          SELECT status, attempt_count, error_code, error_text
          FROM casework.processing_job
          WHERE id = $1
        `,
        [failure.job.id],
      )).rows[0];
      assert.equal(failedRow.status, "failed");
      assert.equal(failedRow.attempt_count, 1);
      assert.equal(failedRow.error_code, "binary_store_failed");
      assert.match(failedRow.error_text, /Synthetic missing binary/u);
    } finally {
      await client.query(
        `
          DELETE FROM casework.processing_job
          WHERE processor_key = 'mock_store_fail'
        `,
      );
    }
  });
});

dbTest("processOneJob persists failure and recoverRunningJobs requeues abandoned jobs", async () => {
  await withClient("phase-c3-test-process-failure", async (client) => {
    await assertProcessingSchema(client);
    const binary = (await client.query(
      `
        SELECT id
        FROM casework.file_binary
        ORDER BY id ASC
        LIMIT 1
      `,
    )).rows[0];
    await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "mock_fail_case",
      processorVersion: "v1",
      status: "queued",
      attemptCount: 0,
      maxAttempts: 1,
      startedAtExpr: "NULL",
      completedAtExpr: "NULL",
    });
    const failingRegistry = [
      {
        key: "mock_fail_case",
        version: "v1",
        representationKind: "extracted_document_bundle",
        supportsBinary() {
          return true;
        },
        async execute() {
          throw new Error("boom");
        },
      },
    ];
    try {
      const failure = await processOneJob(client, { registry: failingRegistry });
      assert.equal(failure.status, "failed");
      const failedRow = (await client.query(
        `
          SELECT status, attempt_count, error_code
          FROM casework.processing_job
          WHERE id = $1
        `,
        [failure.job.id],
      )).rows[0];
      assert.equal(failedRow.status, "failed");
      assert.equal(failedRow.attempt_count, 1);
      assert.equal(failedRow.error_code, "processor_failed");

      const runningJob = await insertJob(client, {
        fileBinaryId: binary.id,
        processorKey: "recovery_test_processor",
        processorVersion: "v1",
        status: "running",
        attemptCount: 1,
        startedAtExpr: "NOW() - INTERVAL '90 minutes'",
        completedAtExpr: "NULL",
      });
      const recovered = await recoverRunningJobs(client, { olderThanMinutes: 30 });
      assert.ok(recovered.includes(runningJob.id));
      const recoveredRow = (await client.query(
        `
          SELECT status, error_code
          FROM casework.processing_job
          WHERE id = $1
        `,
        [runningJob.id],
      )).rows[0];
      assert.equal(recoveredRow.status, "queued");
      assert.equal(recoveredRow.error_code, "worker_recovery");
    } finally {
      await client.query(
        `
          DELETE FROM casework.processing_job
          WHERE processor_key IN ('mock_fail_case', 'recovery_test_processor')
            AND requested_by IN ('phase-c3-test', 'processing-admin-recover')
        `,
      );
    }
  });
});

dbTest("enqueueJobsForBinary avoids duplicate active work and completed-output duplication", async () => {
  await withRollbackDb(async (client, binary) => {
    const first = await enqueueJobsForBinary(client, await getBinaryRowById(client, binary.id));
    assert.ok(first.some((item) => item.action === "enqueued"));
    const second = await enqueueJobsForBinary(client, await getBinaryRowById(client, binary.id));
    assert.ok(second.every((item) => item.action === "already_active"));

    await client.query(
      `
        UPDATE casework.processing_job
        SET status = 'completed', completed_at = NOW(), attempt_count = 1
        WHERE file_binary_id = $1
      `,
      [binary.id],
    );
    const doclingJob = (await client.query(
      `
        SELECT id
        FROM casework.processing_job
        WHERE file_binary_id = $1
          AND processor_key = 'docling'
        ORDER BY id ASC
        LIMIT 1
      `,
      [binary.id],
    )).rows[0];
    await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: doclingJob.id,
      processorKey: "docling",
      processorVersion: "2.123.1",
    });
    const third = await enqueueJobsForBinary(client, await getBinaryRowById(client, binary.id));
    assert.ok(third.some((item) => item.processor_key === "docling" && item.action === "already_satisfied"));
  });
});
