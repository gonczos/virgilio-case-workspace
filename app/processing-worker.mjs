import process from "node:process";

import { assertProcessingSchema, withClient } from "./processing-common.mjs";
import { runWorkerLoop } from "./processing-store.mjs";

function parseArgs(argv) {
  const options = {
    once: false,
    pollMs: 2000,
    maxJobs: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--once") {
      options.once = true;
    } else if (value === "--poll-ms") {
      options.pollMs = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--max-jobs") {
      options.maxJobs = Number(argv[index + 1]);
      index += 1;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await withClient("processing-worker", async (client) => {
    await assertProcessingSchema(client);
    const processed = await runWorkerLoop(client, options);
    for (const item of processed) {
      if (item.status === "completed") {
        console.log(`[processing-worker] completed job=${item.job.id} representation=${item.representation.id}`);
      } else {
        console.log(`[processing-worker] failed job=${item.job.id} error=${item.error}`);
      }
    }
    if (!processed.length) {
      console.log("[processing-worker] no claimable jobs");
    }
  });
}

main().catch((error) => {
  console.error("[processing-worker] fatal error");
  console.error(error);
  process.exitCode = 1;
});
