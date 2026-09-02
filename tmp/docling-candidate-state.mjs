import { withClient } from "../app/processing-common.mjs";
import { DOCLING_PROCESSOR_VERSION, XBERG_PROCESSOR_VERSION } from "../app/processing-registry.mjs";

await withClient("docling-candidate-state", async (client) => {
  const result = await client.query(`
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
    ), candidates AS (
      SELECT fb.id, fb.sha256, fb.machine_readability_status, fb.page_count,
             x.text_length, x.has_failed_job,
             CASE
               WHEN fb.machine_readability_status IN ('image_only_pdf','mostly_image_pdf','mixed_pdf') THEN 'structure_class'
               WHEN x.has_failed_job THEN 'xberg_failed'
               WHEN COALESCE(x.text_length, 0) = 0 THEN 'xberg_empty'
               WHEN x.text_length < 100 THEN 'xberg_weak_lt_100'
             END AS reason
      FROM casework.file_binary fb
      JOIN xberg x ON x.file_binary_id = fb.id
      WHERE fb.mime_type = 'application/pdf'
        AND (
          fb.machine_readability_status IN ('image_only_pdf','mostly_image_pdf','mixed_pdf')
          OR x.has_failed_job
          OR COALESCE(x.text_length, 0) < 100
        )
        AND NOT EXISTS (
          SELECT 1 FROM casework.document_representation dr
          WHERE dr.file_binary_id = fb.id
            AND dr.processor_key = 'docling'
            AND dr.processor_version = $2
        )
    )
    SELECT reason, count(*)::int AS binaries, sum(page_count)::int AS pages
    FROM candidates GROUP BY reason ORDER BY reason
  `, [XBERG_PROCESSOR_VERSION, DOCLING_PROCESSOR_VERSION]);
  process.stdout.write(JSON.stringify(result.rows, null, 2));
}, { logClientLifecycle: false });
