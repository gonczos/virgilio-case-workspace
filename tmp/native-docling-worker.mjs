import { runProcessingWorker } from "../app/processing-worker.mjs";
import { listBuiltinProcessors } from "../app/processing-registry.mjs";
import { runWorkerLoop } from "../app/processing-store.mjs";

const builtin = listBuiltinProcessors().find((item) => item.key === "docling");
const nativeRegistry = [{
  ...builtin,
  executionPolicy: {
    ...builtin.executionPolicy,
    concurrencyGroup: "temporary_native_docling",
    maxConcurrentInGroup: 3,
  },
}];

await runProcessingWorker({ once: false, pollMs: 2000, maxJobs: null }, {
  runWorkerLoopImpl(client, options) {
    return runWorkerLoop(client, { ...options, registry: nativeRegistry });
  },
});
