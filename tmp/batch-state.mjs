import process from "node:process";

import { withClient } from "../app/processing-common.mjs";

const batch = process.argv[2];
const processorKeys = batch === "cheap"
  ? ["pdf_literal_text", "pdf_signature_metadata", "pdf_structure_inventory"]
  : batch === "xberg"
    ? ["xberg"]
    : batch === "docling"
      ? ["docling"]
      : batch === "native-docling"
        ? ["docling"]
    : null;
if (!processorKeys) {
  throw new Error("Batch must be cheap, xberg, docling, or native-docling");
}

await withClient("batch-state", async (client) => {
  const result = await client.query(
    `
      SELECT status, COUNT(*)::int AS count
      FROM casework.processing_job
      WHERE processor_key = ANY($1::text[])
      GROUP BY status
    `,
    [processorKeys],
  );
  const state = { queued: 0, running: 0, completed: 0, failed: 0 };
  for (const row of result.rows) {
    state[row.status] = row.count;
  }
  process.stdout.write(JSON.stringify(state));
}, { logClientLifecycle: false });
