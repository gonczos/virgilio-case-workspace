import { assertProcessingSchema, withClient } from "../app/processing-common.mjs";
import { XBERG_PROCESSOR_VERSION } from "../app/processing-registry.mjs";
import { enqueueJobsForBinary } from "../app/processing-store.mjs";

await withClient("enqueue-selective-docling", async (client) => {
  await assertProcessingSchema(client);
  const candidates = await client.query(`
    WITH xberg AS (
      SELECT fb.id AS file_binary_id,
             bool_or(pj.status = 'failed') AS has_failed_job,
             max(CASE WHEN dr.processor_version = $1 THEN
               COALESCE((dr.content_json->>'text_length')::int, 0)
             END) AS text_length
      FROM casework.file_binary fb
      LEFT JOIN casework.processing_job pj
        ON pj.file_binary_id = fb.id AND pj.processor_key = 'xberg'
      LEFT JOIN casework.document_representation dr
        ON dr.file_binary_id = fb.id AND dr.processor_key = 'xberg'
      WHERE fb.mime_type = 'application/pdf'
      GROUP BY fb.id
    )
    SELECT fb.*
    FROM casework.file_binary fb
    JOIN xberg x ON x.file_binary_id = fb.id
    WHERE fb.mime_type = 'application/pdf'
      AND (
        fb.machine_readability_status IN ('image_only_pdf','mostly_image_pdf','mixed_pdf')
        OR x.has_failed_job
        OR COALESCE(x.text_length, 0) < 100
      )
    ORDER BY fb.id
  `, [XBERG_PROCESSOR_VERSION]);

  const counts = new Map();
  for (const binary of candidates.rows) {
    const results = await enqueueJobsForBinary(client, binary, {
      requestedBy: "selective-docling-2026-09-02",
      processorKeys: ["docling"],
    });
    for (const result of results) {
      counts.set(result.action, (counts.get(result.action) ?? 0) + 1);
    }
  }
  process.stdout.write(JSON.stringify({
    candidate_count: candidates.rowCount,
    results: Object.fromEntries([...counts.entries()].sort()),
  }, null, 2));
}, { logClientLifecycle: false });
