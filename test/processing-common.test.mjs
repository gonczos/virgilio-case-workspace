import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { attachClientLifecycleLogging } from "../app/processing-common.mjs";
import { sanitizePostgresText } from "../app/processing-registry.mjs";

test("sanitizePostgresText removes only NUL characters and reports their count", () => {
  const input = "before\u0000middle\r\nAção 😀\u0000after";

  assert.deepEqual(sanitizePostgresText(input), {
    text: "beforemiddle\r\nAção 😀after",
    nulCount: 2,
    warning: {
      warning_code: "nul_characters_removed_for_postgres",
      removed_character_count: 2,
      affected_field: "document_segment.text_content",
      source_artifact_preserved: true,
    },
  });
  assert.deepEqual(sanitizePostgresText(input.replaceAll("\u0000", "")), {
    text: "beforemiddle\r\nAção 😀after",
    nulCount: 0,
    warning: null,
  });
});

test("attachClientLifecycleLogging logs client errors and unexpected end", () => {
  const client = new EventEmitter();
  const entries = [];
  const logger = {
    error(value) {
      entries.push(value);
    },
  };

  attachClientLifecycleLogging(client, {
    logPrefix: "[processing-worker]",
    logger,
  });

  const error = new Error("Connection terminated unexpectedly");
  client.emit("error", error);
  client.emit("end");

  assert.equal(entries[0], "[processing-worker] PostgreSQL client error");
  assert.equal(entries[1], error);
  assert.equal(entries[2], "[processing-worker] PostgreSQL client connection ended unexpectedly");
});

test("attachClientLifecycleLogging does not log end after expected dispose", () => {
  const client = new EventEmitter();
  const entries = [];
  const logger = {
    error(value) {
      entries.push(value);
    },
  };

  const logging = attachClientLifecycleLogging(client, {
    logPrefix: "[processing-worker]",
    logger,
  });

  logging.dispose();
  client.emit("end");

  assert.deepEqual(entries, []);
});
