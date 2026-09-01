import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldRunWorkerLoopForEnqueueResults,
} from "../app/phase-c5.3.2-rollout.mjs";

test("rollout helper skips worker draining when sample is already satisfied", () => {
  assert.equal(shouldRunWorkerLoopForEnqueueResults([
    {
      file_binary_id: 1,
      results: [
        { action: "already_satisfied" },
        { action: "already_satisfied" },
      ],
    },
  ]), false);
});

test("rollout helper drains worker when new or active sample work exists", () => {
  assert.equal(shouldRunWorkerLoopForEnqueueResults([
    {
      file_binary_id: 1,
      results: [
        { action: "already_satisfied" },
        { action: "enqueued" },
      ],
    },
  ]), true);

  assert.equal(shouldRunWorkerLoopForEnqueueResults([
    {
      file_binary_id: 1,
      results: [
        { action: "already_active" },
      ],
    },
  ]), true);
});
