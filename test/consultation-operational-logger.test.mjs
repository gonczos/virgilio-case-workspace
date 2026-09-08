import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { createOperationalLogger, errorFields } from "../app/consultation-operational-logger.mjs";

test("operational logger writes JSON Lines without raw local paths or bearer values", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "consultation-log-"));
  const logPath = path.join(directory, "service.log");
  const stderrLines = [];
  const logger = createOperationalLogger({
    service: "test-service", logPath, stderr: { error: (line) => stderrLines.push(line) },
  });
  logger.error("tool_call_completed", {
    tool_name: "search_document_text",
    ...errorFields(new Error("failed at C:\\secret\\document.pdf with Bearer private-token")),
  });
  await logger.close();
  const line = (await fs.readFile(logPath, "utf8")).trim();
  assert.equal(line, stderrLines[0]);
  const record = JSON.parse(line);
  assert.equal(record.event, "tool_call_completed");
  assert.match(record.error_message, /<local-path>/u);
  assert.match(record.error_message, /Bearer <redacted>/u);
  assert.doesNotMatch(line, /private-token|secret\\document/u);
});

test("operational logger removes container paths and credential query values", () => {
  const fields = errorFields(new Error(
    "failed at /workspace/data/private/document.pdf?client_secret=hidden and /tmp/output.log",
  ));
  assert.doesNotMatch(fields.error_message, /workspace|private\/document|tmp\/output|hidden/u);
  assert.match(fields.error_message, /<local-path>/u);
});
