import { withClient } from "../app/processing-common.mjs";

await withClient("list-docling-failures", async (client) => {
  const result = await client.query(`
    SELECT
      fb.sha256,
      fb.page_count,
      fb.machine_readability_status,
      pj.id AS processing_job_id,
      pj.error_code,
      substring(pj.error_text from '"text_length": ([0-9]+)')::int AS extracted_text_length,
      substring(pj.error_text from '"table_count": ([0-9]+)')::int AS extracted_table_count,
      left(pj.error_text, 2000) AS error_text
    FROM casework.processing_job pj
    JOIN casework.file_binary fb ON fb.id = pj.file_binary_id
    WHERE pj.processor_key = 'docling'
      AND pj.status = 'failed'
    ORDER BY pj.id
  `);
  process.stdout.write(JSON.stringify(result.rows, null, 2));
}, { logClientLifecycle: false });
