import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertProcessingSchema, sleep, withClient } from "./processing-common.mjs";
import { recoverClaimedJobIfRunning, runWorkerLoop } from "./processing-store.mjs";

export function parseArgs(argv) {
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

export async function runProcessingWorker(options, {
  withClientImpl = withClient,
  sleepImpl = sleep,
  logger = console,
  assertProcessingSchemaImpl = assertProcessingSchema,
  runWorkerLoopImpl = runWorkerLoop,
  recoverClaimedJobIfRunningImpl = recoverClaimedJobIfRunning,
} = {}) {
  let remaining = options.maxJobs;
  while (remaining === null || remaining > 0) {
    let claimedJobId = null;
    try {
      const processed = await withClientImpl("processing-worker", async (client) => {
        await assertProcessingSchemaImpl(client);
        return runWorkerLoopImpl(client, {
          ...options,
          once: true,
          maxJobs: 1,
          afterClaim: async (jobRow) => {
            claimedJobId = jobRow.id;
          },
        });
      }, {
        logClientLifecycle: true,
        logPrefix: "[processing-worker]",
        logger,
      });
      for (const item of processed) {
        if (item.status === "completed") {
          logger.log(`[processing-worker] completed job=${item.job.id} representation=${item.representation.id}`);
        } else {
          logger.log(`[processing-worker] failed job=${item.job.id} error=${item.error}`);
        }
      }
      if (!processed.length) {
        if (options.once) {
          logger.log("[processing-worker] no claimable jobs");
          break;
        }
        await sleepImpl(options.pollMs);
        continue;
      }
      if (remaining !== null) {
        remaining -= processed.length;
      }
      if (options.once) {
        break;
      }
    } catch (error) {
      logger.error("[processing-worker] worker cycle failed");
      logger.error(error);
      if (claimedJobId !== null) {
        try {
          await withClientImpl("processing-worker-recover", async (client) => {
            await recoverClaimedJobIfRunningImpl(client, claimedJobId);
          }, {
            logClientLifecycle: true,
            logPrefix: "[processing-worker-recover]",
            logger,
          });
        } catch (recoveryError) {
          logger.error(`[processing-worker] failed to recover claimed job=${claimedJobId}`);
          logger.error(recoveryError);
        }
      }
      if (options.once) {
        throw error;
      }
      await sleepImpl(options.pollMs);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await runProcessingWorker(options);
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    console.error("[processing-worker] fatal error");
    console.error(error);
    process.exitCode = 1;
  });
}
