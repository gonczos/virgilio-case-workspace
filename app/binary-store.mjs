import fs from "node:fs/promises";

import { resolveBinaryPath, sha256File } from "./processing-common.mjs";

export class BinaryStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BinaryStoreError";
    this.code = code;
    this.details = details;
  }
}

export function isBinaryStoreError(error) {
  return error instanceof BinaryStoreError;
}

async function assertReadableFile(localPath, binaryRow) {
  try {
    await fs.access(localPath);
  } catch (error) {
    throw new BinaryStoreError(
      "binary_missing",
      `Canonical binary is not readable for file_binary ${binaryRow.id}: ${localPath}`,
      { cause: error, localPath, fileBinaryId: binaryRow.id },
    );
  }
}

async function assertExpectedSize(localPath, binaryRow) {
  if (binaryRow.actual_size_bytes === null || binaryRow.actual_size_bytes === undefined) {
    return;
  }
  let stats;
  try {
    stats = await fs.stat(localPath);
  } catch (error) {
    throw new BinaryStoreError(
      "binary_missing",
      `Canonical binary is not readable for file_binary ${binaryRow.id}: ${localPath}`,
      { cause: error, localPath, fileBinaryId: binaryRow.id },
    );
  }
  if (Number(stats.size) !== Number(binaryRow.actual_size_bytes)) {
    throw new BinaryStoreError(
      "binary_size_mismatch",
      `Canonical binary size mismatch for file_binary ${binaryRow.id}: expected ${binaryRow.actual_size_bytes}, got ${stats.size}`,
      { localPath, fileBinaryId: binaryRow.id, expectedSize: Number(binaryRow.actual_size_bytes), actualSize: Number(stats.size) },
    );
  }
}

export class LocalBinaryStore {
  constructor({ workspaceRoot }) {
    this.workspaceRoot = workspaceRoot;
  }

  resolve(binaryRow) {
    try {
      return resolveBinaryPath(this.workspaceRoot, binaryRow);
    } catch (error) {
      throw new BinaryStoreError(
        "binary_locator_invalid",
        error instanceof Error ? error.message : String(error),
        { cause: error, fileBinaryId: binaryRow.id },
      );
    }
  }

  async exists(binaryRow) {
    try {
      await fs.access(this.resolve(binaryRow));
      return true;
    } catch {
      return false;
    }
  }

  async verify(binaryRow, { verifySha256 = false } = {}) {
    const localPath = this.resolve(binaryRow);
    await assertReadableFile(localPath, binaryRow);
    await assertExpectedSize(localPath, binaryRow);
    if (verifySha256) {
      const actualSha256 = await sha256File(localPath);
      if (actualSha256 !== binaryRow.sha256) {
        throw new BinaryStoreError(
          "binary_sha256_mismatch",
          `Canonical binary SHA-256 mismatch for file_binary ${binaryRow.id}`,
          { localPath, fileBinaryId: binaryRow.id, expectedSha256: binaryRow.sha256, actualSha256 },
        );
      }
    }
    return {
      localPath,
      verified: true,
      sha256Verified: verifySha256,
    };
  }

  async materialize(binaryRow) {
    const localPath = this.resolve(binaryRow);
    await assertReadableFile(localPath, binaryRow);
    await assertExpectedSize(localPath, binaryRow);
    return {
      localPath,
      materializationKind: "canonical_local_path",
      isTemporary: false,
      async release() {},
    };
  }
}
