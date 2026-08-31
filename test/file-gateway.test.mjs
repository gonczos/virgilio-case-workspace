import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { BinaryStoreError } from "../app/binary-store.mjs";
import { createGatewayServer } from "../app/file-gateway.mjs";

async function withServer({ client, binaryStore }, fn) {
  const server = createGatewayServer({ client, binaryStore });
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  try {
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function request(baseUrl, requestPath, { method = "GET" } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(requestPath, baseUrl), { method }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => {
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

test("gateway serves an existing binary through BinaryStore and releases after response completion", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-gateway-"));
  const tempFile = path.join(tempRoot, "binary.txt");
  await fs.writeFile(tempFile, "hello gateway", "utf8");
  const events = [];
  const client = {
    async query(_sql, [sha256]) {
      return {
        rows: [{
          id: 101,
          sha256,
          mime_type: "text/plain",
          file_extension: ".txt",
          storage_package_id: "../bad-package",
          storage_rel_path: "../escape.txt",
          actual_size_bytes: 13,
        }],
      };
    },
  };
  let releaseResolved;
  const releasePromise = new Promise((resolve) => {
    releaseResolved = resolve;
  });
  const binaryStore = {
    async materialize(row) {
      events.push({ stage: "materialize", binaryId: row.id });
      return {
        localPath: tempFile,
        materializationKind: "test_materialization",
        isTemporary: false,
        async release() {
          events.push({ stage: "release", binaryId: row.id });
          releaseResolved();
        },
      };
    },
  };
  try {
    await withServer({ client, binaryStore }, async (baseUrl) => {
      const response = await request(baseUrl, "/binary/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      assert.equal(response.statusCode, 200);
      assert.equal(response.body, "hello gateway");
      assert.equal(response.headers["content-type"], "text/plain");
      assert.equal(response.headers["content-length"], "13");
      assert.equal(
        response.headers["content-disposition"],
        "inline; filename=\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.txt\"",
      );
      assert.deepEqual(events, [{ stage: "materialize", binaryId: 101 }]);
      await releasePromise;
      assert.deepEqual(events, [
        { stage: "materialize", binaryId: 101 },
        { stage: "release", binaryId: 101 },
      ]);
    });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("gateway serves HEAD requests through BinaryStore without changing visible behavior", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-gateway-head-"));
  const tempFile = path.join(tempRoot, "binary.txt");
  await fs.writeFile(tempFile, "head body", "utf8");
  let released = false;
  const client = {
    async query(_sql, [sha256]) {
      return {
        rows: [{
          id: 102,
          sha256,
          mime_type: "text/plain",
          file_extension: ".txt",
          storage_package_id: "pkg",
          storage_rel_path: "file.txt",
          actual_size_bytes: 9,
        }],
      };
    },
  };
  const binaryStore = {
    async materialize(row) {
      return {
        localPath: tempFile,
        async release() {
          released = true;
        },
      };
    },
  };
  try {
    await withServer({ client, binaryStore }, async (baseUrl) => {
      const response = await request(baseUrl, "/binary/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", { method: "HEAD" });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body, "");
      assert.equal(response.headers["content-length"], "9");
      assert.equal(released, true);
    });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("gateway preserves missing binary lookup behavior", async () => {
  const client = {
    async query() {
      return { rows: [] };
    },
  };
  const binaryStore = {
    async materialize() {
      throw new Error("should not materialize unknown binary");
    },
  };
  await withServer({ client, binaryStore }, async (baseUrl) => {
    const response = await request(baseUrl, "/binary/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");
    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      error: "binary_not_found",
      sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });
  });
});

test("gateway handles binary-store materialization failure safely", async () => {
  const client = {
    async query(_sql, [sha256]) {
      return {
        rows: [{
          id: 103,
          sha256,
          mime_type: "application/pdf",
          file_extension: ".pdf",
          storage_package_id: "pkg",
          storage_rel_path: "missing.pdf",
          actual_size_bytes: 77,
        }],
      };
    },
  };
  const binaryStore = {
    async materialize() {
      throw new BinaryStoreError("binary_missing", "Synthetic missing binary");
    },
  };
  await withServer({ client, binaryStore }, async (baseUrl) => {
    const response = await request(baseUrl, "/binary/dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd");
    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      error: "binary_file_missing",
      sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    });
  });
});

test("gateway maps invalid materialized locators safely without exposing paths", async () => {
  const client = {
    async query(_sql, [sha256]) {
      return {
        rows: [{
          id: 104,
          sha256,
          mime_type: "application/pdf",
          file_extension: ".pdf",
          storage_package_id: "pkg",
          storage_rel_path: "escape.pdf",
          actual_size_bytes: 77,
        }],
      };
    },
  };
  const binaryStore = {
    async materialize() {
      throw new BinaryStoreError("binary_locator_invalid", "Resolved binary path escapes imports root: D:/secret.pdf");
    },
  };
  await withServer({ client, binaryStore }, async (baseUrl) => {
    const response = await request(baseUrl, "/binary/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      error: "invalid_storage_path",
      sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    });
    assert.equal(response.body.includes("secret.pdf"), false);
  });
});
