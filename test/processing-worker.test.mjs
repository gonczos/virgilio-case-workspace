import assert from "node:assert/strict";
import test from "node:test";

import { runProcessingWorker } from "../app/processing-worker.mjs";

test("runProcessingWorker reconnects after a dropped worker client and recovers the claimed running job", async () => {
  const lifecycle = [];
  const loggerEntries = [];
  let workerCycleCount = 0;

  const logger = {
    log(value) {
      loggerEntries.push(value);
    },
    error(value) {
      loggerEntries.push(value);
    },
  };

  await runProcessingWorker({
    once: false,
    pollMs: 7,
    maxJobs: 1,
  }, {
    async assertProcessingSchemaImpl() {},
    logger,
    async recoverClaimedJobIfRunningImpl(_client, jobId) {
      lifecycle.push({ type: "recover-job", jobId });
      return jobId;
    },
    async runWorkerLoopImpl(_client, options) {
      if (workerCycleCount === 1) {
        await options.afterClaim({ id: 12 });
        return [];
      }
      return [{
        status: "completed",
        job: { id: 12 },
        representation: { id: 44 },
      }];
    },
    async sleepImpl(ms) {
      lifecycle.push({ type: "sleep", ms });
    },
    async withClientImpl(applicationName, work) {
      lifecycle.push({ type: "connect", applicationName });
      if (applicationName === "processing-worker-recover") {
        await work({});
        lifecycle.push({ type: "recovered" });
        return undefined;
      }
      workerCycleCount += 1;
      if (workerCycleCount === 1) {
        return work({}).then(() => {
          throw new Error("synthetic connection drop");
        });
      }
      if (workerCycleCount === 2) {
        return work({});
      }
      throw new Error(`unexpected extra worker cycle ${workerCycleCount}`);
    },
  });

  assert.deepEqual(lifecycle, [
    { type: "connect", applicationName: "processing-worker" },
    { type: "connect", applicationName: "processing-worker-recover" },
    { type: "recover-job", jobId: 12 },
    { type: "recovered" },
    { type: "sleep", ms: 7 },
    { type: "connect", applicationName: "processing-worker" },
  ]);
  assert.ok(loggerEntries.includes("[processing-worker] worker cycle failed"));
  assert.ok(loggerEntries.includes("[processing-worker] completed job=12 representation=44"));
});

test("runProcessingWorker leaves an already-completed claimed job untouched during recovery", async () => {
  const recoveryCalls = [];
  let workerCycleCount = 0;

  await runProcessingWorker({
    once: false,
    pollMs: 5,
    maxJobs: 1,
  }, {
    async assertProcessingSchemaImpl() {},
    logger: {
      log() {},
      error() {},
    },
    async recoverClaimedJobIfRunningImpl() {
      recoveryCalls.push("recover-job");
      return null;
    },
    async runWorkerLoopImpl(_client, options) {
      if (workerCycleCount === 1) {
        await options.afterClaim({ id: 81 });
        return [{
          status: "completed",
          job: { id: 81 },
          representation: { id: 99 },
        }];
      }
      return [{
        status: "completed",
        job: { id: 82 },
        representation: { id: 100 },
      }];
    },
    async sleepImpl() {},
    async withClientImpl(applicationName, work) {
      if (applicationName === "processing-worker-recover") {
        recoveryCalls.push("recover");
        await work({});
        return undefined;
      }
      workerCycleCount += 1;
      if (workerCycleCount === 1) {
        return work({}).then(() => {
          const error = new Error("connection lost after commit");
          error.code = "57P01";
          throw error;
        });
      }
      if (workerCycleCount === 2) {
        return work({});
      }
      throw new Error("unexpected extra cycle");
    },
  });

  assert.deepEqual(recoveryCalls, ["recover", "recover-job"]);
});
