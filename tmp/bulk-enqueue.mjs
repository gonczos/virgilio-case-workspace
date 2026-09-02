import process from "node:process";

import { assertProcessingSchema, withClient } from "../app/processing-common.mjs";
import { enqueueJobsForBinary } from "../app/processing-store.mjs";

const processorKeys = process.argv.slice(2);
if (processorKeys.length === 0) {
  throw new Error("Provide at least one processor key");
}

await withClient("bulk-enqueue", async (client) => {
  await assertProcessingSchema(client);
  const binaries = await client.query(`
    SELECT *
    FROM casework.file_binary
    WHERE mime_type = 'application/pdf'
    ORDER BY id ASC
  `);
  const counts = new Map();
  let processed = 0;
  for (const binary of binaries.rows) {
    const results = await enqueueJobsForBinary(client, binary, {
      requestedBy: "temporary-bulk-enqueue",
      processorKeys,
    });
    for (const result of results) {
      const key = `${result.processor_key}:${result.status}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    processed += 1;
    if (processed % 100 === 0) {
      console.log(`[bulk-enqueue] binaries=${processed}/${binaries.rowCount}`);
    }
  }
  console.log(JSON.stringify({
    binary_count: binaries.rowCount,
    processor_keys: processorKeys,
    results: Object.fromEntries([...counts.entries()].sort()),
  }, null, 2));
});
