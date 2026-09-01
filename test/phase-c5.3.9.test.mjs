import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import { inspectPortableBinaryExportPackage } from "../app/portable-export-inspect.mjs";
import { exportPortableBinaryPackage } from "../app/portable-export.mjs";
import {
  assertProcessingSchema,
  getWorkspaceRoot,
  withClient,
} from "../app/processing-common.mjs";

const execFile = promisify(execFileCallback);
const REPRESENTATIVE_SHA = "6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c";

async function withRealClient(fn) {
  return withClient("phase-c5.3.9-test", async (client) => {
    await assertProcessingSchema(client);
    return fn(client);
  });
}

async function withTempDir(fn) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-c5.3.9-"));
  try {
    return await fn(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function findUnprocessedSha(client) {
  const result = await client.query(
    `
      SELECT fb.sha256
      FROM casework.file_binary AS fb
      LEFT JOIN casework.processing_job AS pj
        ON pj.file_binary_id = fb.id
      LEFT JOIN casework.document_representation AS dr
        ON dr.file_binary_id = fb.id
      GROUP BY fb.id, fb.sha256
      HAVING COUNT(pj.id) = 0
         AND COUNT(dr.id) = 0
      ORDER BY fb.id ASC
      LIMIT 1
    `,
  );
  return result.rows[0]?.sha256 ?? null;
}

async function createExportPackage(client, tempRoot, sha256, dirName) {
  const outputDir = path.join(tempRoot, dirName);
  await exportPortableBinaryPackage(client, {
    sha256,
    outputDir,
    workspaceRoot: getWorkspaceRoot(),
  });
  return outputDir;
}

async function readManifest(packageDir) {
  return JSON.parse(await fs.readFile(path.join(packageDir, "manifest.json"), "utf8"));
}

async function writeManifest(packageDir, manifest) {
  await fs.writeFile(
    path.join(packageDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

test("inspectPortableBinaryExportPackage verifies a processed export package", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "processed");
      const result = await inspectPortableBinaryExportPackage({ packageDir });

      assert.equal(result.report.file_binary.sha256, REPRESENTATIVE_SHA);
      assert.equal(result.report.representation_count >= 1, true);
      assert.equal(result.report.processing_job_count >= 1, true);
      assert.equal(result.report.comparison_count >= 1, true);
      assert.equal(Array.isArray(result.report.representation_artifacts), true);
      assert.equal(result.report.representation_artifacts.length >= 1, true);
    });
  });
});

test("inspectPortableBinaryExportPackage accepts an unprocessed export package", async () => {
  await withRealClient(async (client) => {
    const sha256 = await findUnprocessedSha(client);
    assert.ok(sha256);
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, sha256, "unprocessed");
      const result = await inspectPortableBinaryExportPackage({ packageDir });

      assert.equal(result.report.file_binary.sha256, sha256);
      assert.equal(result.report.representation_count, 0);
      assert.equal(result.report.processing_job_count, 0);
      assert.equal(result.report.comparison_count, 0);
      assert.equal(result.report.selection_count, 0);
      assert.deepEqual(result.report.representation_artifacts, []);
    });
  });
});

test("inspectPortableBinaryExportPackage rejects unsupported package format", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "bad-format");
      const manifest = await readManifest(packageDir);
      manifest.package_format = "unexpected-format";
      await writeManifest(packageDir, manifest);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /Unsupported package_format/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects unsupported package version", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "bad-version");
      const manifest = await readManifest(packageDir);
      manifest.package_version = 999;
      await writeManifest(packageDir, manifest);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /Unsupported package_version/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects original SHA corruption", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "sha-corruption");
      const manifest = await readManifest(packageDir);
      const originalPath = path.join(packageDir, manifest.package_contents.original_binary.package_path);
      const originalContent = await fs.readFile(originalPath);
      const corrupted = Buffer.from(originalContent);
      corrupted[0] = corrupted[0] ^ 0xff;
      await fs.writeFile(originalPath, corrupted);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /SHA-256 mismatch/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects original size mismatch", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "size-mismatch");
      const manifest = await readManifest(packageDir);
      const originalPath = path.join(packageDir, manifest.package_contents.original_binary.package_path);
      const originalContent = await fs.readFile(originalPath);
      await fs.writeFile(originalPath, originalContent.subarray(0, originalContent.length - 1));

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /size mismatch/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects missing original", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "missing-original");
      const manifest = await readManifest(packageDir);
      const originalPath = path.join(packageDir, manifest.package_contents.original_binary.package_path);
      await fs.rm(originalPath);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /original binary is missing/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects malformed manifest JSON", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "bad-manifest");
      await fs.writeFile(path.join(packageDir, "manifest.json"), "{not-json\n", "utf8");

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /manifest is malformed/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects a missing manifest-listed artifact file", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "missing-artifact-file");
      const manifest = await readManifest(packageDir);
      const artifactSet = manifest.package_contents.representation_artifacts[0];
      assert.ok(artifactSet);
      const copiedFile = artifactSet.copied_files[0];
      assert.ok(copiedFile);
      const artifactPath = path.join(packageDir, artifactSet.package_dir, copiedFile.relativePath);
      await fs.rm(artifactPath);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /artifact file is missing/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects a representation missing its artifact entry", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "missing-artifact-entry");
      const manifest = await readManifest(packageDir);
      const removed = manifest.package_contents.representation_artifacts.shift();
      assert.ok(removed);
      await writeManifest(packageDir, manifest);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /persisted artifact_rel_path but no package artifact entry/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects package-escaping original paths", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "path-escape-original");
      const manifest = await readManifest(packageDir);
      manifest.package_contents.original_binary.package_path = "../outside.bin";
      await writeManifest(packageDir, manifest);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /outside the inspected package root/u,
      );
    });
  });
});

test("inspectPortableBinaryExportPackage rejects package-escaping artifact file paths", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "path-escape-artifact");
      const manifest = await readManifest(packageDir);
      manifest.package_contents.representation_artifacts[0].copied_files[0].relativePath = "../../escape.txt";
      await writeManifest(packageDir, manifest);

      await assert.rejects(
        () => inspectPortableBinaryExportPackage({ packageDir }),
        /outside the inspected package root/u,
      );
    });
  });
});

test("processing-admin inspect-export works without a usable DB connection", async () => {
  await withRealClient(async (client) => {
    await withTempDir(async (tempRoot) => {
      const packageDir = await createExportPackage(client, tempRoot, REPRESENTATIVE_SHA, "cli-inspect");
      const result = await execFile(
        process.execPath,
        ["app/processing-admin.mjs", "inspect-export", "--package", packageDir],
        {
          cwd: getWorkspaceRoot(),
          env: {
            ...process.env,
            DATABASE_URL: "postgres://invalid:invalid@127.0.0.1:1/invalid",
            PGHOST: "127.0.0.1",
            PGPORT: "1",
            PGDATABASE: "invalid",
            PGUSER: "invalid",
            PGPASSWORD: "invalid",
          },
          windowsHide: true,
        },
      );
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.file_binary.sha256, REPRESENTATIVE_SHA);
      assert.equal(stdout.representation_count >= 1, true);
    });
  });
});
