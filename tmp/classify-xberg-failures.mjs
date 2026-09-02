import { withClient } from "../app/processing-common.mjs";

await withClient("classify-xberg-failures", async (client) => {
  const result = await client.query(`
    SELECT
      CASE
        WHEN error_text LIKE '%0x00%' THEN 'nul_byte_persistence'
        WHEN error_text LIKE '%Catalog missing /Pages%' THEN 'invalid_pdf_catalog'
        WHEN error_text ILIKE '%comparison%constraint%' THEN 'comparison_constraint'
        ELSE 'other'
      END AS category,
      COUNT(*)::int AS count
    FROM casework.processing_job
    WHERE processor_key = 'xberg' AND status = 'failed'
    GROUP BY 1
    ORDER BY 1
  `);
  const failures = await client.query(`
    SELECT
      fb.sha256,
      pj.id AS processing_job_id,
      CASE
        WHEN pj.error_text LIKE '%0x00%' THEN 'nul_byte_persistence'
        WHEN pj.error_text LIKE '%Catalog missing /Pages%' THEN 'invalid_pdf_catalog_missing_pages'
        WHEN pj.error_text LIKE '%Pages node missing Kids%' THEN 'invalid_pdf_pages_missing_kids'
        WHEN pj.error_text ILIKE '%comparison%constraint%' THEN 'comparison_constraint'
        ELSE 'other'
      END AS category,
      pj.error_code
    FROM casework.processing_job pj
    JOIN casework.file_binary fb ON fb.id = pj.file_binary_id
    WHERE pj.processor_key = 'xberg'
      AND pj.status = 'failed'
    ORDER BY category, fb.sha256
  `);
  process.stdout.write(JSON.stringify({ categories: result.rows, failures: failures.rows }, null, 2));
}, { logClientLifecycle: false });
