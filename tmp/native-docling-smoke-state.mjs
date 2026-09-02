import { withClient } from "../app/processing-common.mjs";

await withClient("native-docling-smoke-state", async (client) => {
  const result = await client.query(`
    SELECT pj.id, fb.sha256, fb.page_count, pj.status, pj.started_at, pj.completed_at,
           round(extract(epoch from (pj.completed_at - pj.started_at))::numeric, 3) AS duration_seconds
    FROM casework.processing_job pj
    JOIN casework.file_binary fb ON fb.id = pj.file_binary_id
    WHERE pj.requested_by = 'native-docling-2026-09-02'
    ORDER BY pj.id
  `);
  process.stdout.write(JSON.stringify(result.rows, null, 2));
}, { logClientLifecycle: false });
