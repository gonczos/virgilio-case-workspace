import { assertProcessingSchema, withClient } from "../app/processing-common.mjs";
import { enqueueJobsForBinary } from "../app/processing-store.mjs";

const limitArg = process.argv[2] ?? "all";
const limit = limitArg === "all" ? null : Number(limitArg);
if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error("Limit must be a positive integer or 'all'");
}

await withClient("enqueue-native-docling", async (client) => {
  await assertProcessingSchema(client);
  const candidates = await client.query(`
    SELECT fb.*
    FROM casework.file_binary fb
    WHERE fb.mime_type = 'application/pdf'
      AND fb.machine_readability_status = 'text_pdf'
      AND NOT EXISTS (
        SELECT 1 FROM casework.document_representation dr
        WHERE dr.file_binary_id = fb.id
          AND dr.processor_key = 'docling'
          AND dr.processor_version = '2.123.1-c5.2'
      )
    ORDER BY fb.page_count ASC, fb.id ASC
    ${limit === null ? "" : "LIMIT $1"}
  `, limit === null ? [] : [limit]);
  const counts = new Map();
  for (const binary of candidates.rows) {
    const results = await enqueueJobsForBinary(client, binary, {
      requestedBy: "native-docling-2026-09-02",
      processorKeys: ["docling"],
    });
    for (const result of results) counts.set(result.action, (counts.get(result.action) ?? 0) + 1);
  }
  process.stdout.write(JSON.stringify({ candidates: candidates.rowCount, results: Object.fromEntries(counts) }, null, 2));
}, { logClientLifecycle: false });
