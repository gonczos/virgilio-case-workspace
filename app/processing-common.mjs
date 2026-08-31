import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

export const DEFAULT_REPRESENTATION_KIND = "extracted_document_bundle";
export const DEFAULT_STAGE_KEY = "EXTRACT_STRUCTURE";
export const HUMAN_STAGE_KEY = "HUMAN_CREATE_REPRESENTATION";
export const PROCESSING_OUTPUT_ROOT = path.join("data", "exports", "processing");
export const PROCESSING_RUNTIME_ROOT = path.join("data", "processing-runtime");
export const LEGACY_PHASE_C2_OUTPUT_ROOT = path.join("data", "exports", "phase-c2");
export const PYTHON_PATH = path.join(".venv-processing", "Scripts", "python.exe");
export const EXTRACTOR_PATH = path.join("app", "processors", "extract-document.py");
export const DEFAULT_SELECTION_PURPOSE = "consultation_default";
export const QUICK_PREVIEW_PURPOSE = "quick_preview";
export const COMPARISON_KIND = "normalized_text";
export const COMPARATOR_KEY = "app/processing-comparison.mjs";
export const COMPARATOR_VERSION = "v1";

export function getWorkspaceRoot() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..");
}

export function loadDotEnv(envPath) {
  if (!fsSync.existsSync(envPath)) {
    return;
  }
  const content = fsSync.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function createDbClient(applicationName) {
  return new Client({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.POSTGRES_DB ?? process.env.PGDATABASE,
    user: process.env.POSTGRES_USER ?? process.env.PGUSER,
    password: process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD,
    application_name: applicationName,
  });
}

export async function withClient(applicationName, work) {
  const workspaceRoot = getWorkspaceRoot();
  loadDotEnv(path.join(workspaceRoot, ".env"));
  const client = createDbClient(applicationName);
  await client.connect();
  try {
    return await work(client, workspaceRoot);
  } finally {
    await client.end();
  }
}

export async function withTransaction(client, work) {
  await client.query("BEGIN");
  try {
    const result = await work();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export function slugify(value) {
  return String(value).replace(/[^a-z0-9]+/giu, "-").replace(/^-+|-+$/gu, "").toLowerCase() || "value";
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

export async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const content = await fs.readFile(filePath);
  hash.update(content);
  return hash.digest("hex");
}

export function resolveBinaryPath(workspaceRoot, binaryRow) {
  if (!binaryRow.storage_package_id || !binaryRow.storage_rel_path) {
    throw new Error(`file_binary ${binaryRow.id} does not have a resolvable storage path`);
  }
  const importsRoot = path.join(workspaceRoot, "data", "imports");
  const resolvedPath = path.resolve(importsRoot, binaryRow.storage_package_id, binaryRow.storage_rel_path);
  const allowedRoot = path.resolve(importsRoot);
  if (!resolvedPath.startsWith(allowedRoot)) {
    throw new Error(`Resolved binary path escapes imports root: ${resolvedPath}`);
  }
  return resolvedPath;
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function buildProcessingRuntimeEnv(workspaceRoot) {
  const runtimeRoot = path.join(workspaceRoot, PROCESSING_RUNTIME_ROOT);
  const legacyPhaseC2Root = path.join(workspaceRoot, LEGACY_PHASE_C2_OUTPUT_ROOT);
  const legacyCacheRoot = path.join(legacyPhaseC2Root, ".cache");
  const legacyHfRoot = path.join(legacyCacheRoot, "huggingface");
  const legacyLocalAppDataRoot = path.join(legacyPhaseC2Root, ".localappdata");
  const cacheRoot = fsSync.existsSync(legacyCacheRoot) ? legacyCacheRoot : path.join(runtimeRoot, "cache");
  const hfRoot = fsSync.existsSync(legacyHfRoot) ? legacyHfRoot : path.join(cacheRoot, "huggingface");
  const tempRoot = path.join(runtimeRoot, "tmp");
  const localAppDataRoot = fsSync.existsSync(legacyLocalAppDataRoot)
    ? legacyLocalAppDataRoot
    : path.join(runtimeRoot, "localappdata");
  fsSync.mkdirSync(cacheRoot, { recursive: true });
  fsSync.mkdirSync(hfRoot, { recursive: true });
  fsSync.mkdirSync(tempRoot, { recursive: true });
  fsSync.mkdirSync(localAppDataRoot, { recursive: true });
  return {
    ...process.env,
    XDG_CACHE_HOME: cacheRoot,
    HF_HOME: hfRoot,
    HUGGINGFACE_HUB_CACHE: path.join(hfRoot, "hub"),
    HF_HUB_OFFLINE: process.env.HF_HUB_OFFLINE ?? "1",
    TRANSFORMERS_OFFLINE: process.env.TRANSFORMERS_OFFLINE ?? "1",
    TEMP: tempRoot,
    TMP: tempRoot,
    TMPDIR: tempRoot,
    LOCALAPPDATA: localAppDataRoot,
  };
}

export async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function buildHumanVariantKey({ createdBy, textContent }) {
  const timestamp = new Date().toISOString().replace(/[^0-9]/gu, "");
  const digest = crypto.createHash("sha256").update(`${createdBy}\n${textContent}`).digest("hex").slice(0, 12);
  return `human-${timestamp}-${digest}`;
}

export async function makeTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function assertProcessingSchema(client) {
  const result = await client.query(
    `
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'casework' AND table_name = 'processing_job'
        ) AS has_processing_job,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'casework' AND table_name = 'document_representation'
        ) AS has_document_representation,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'casework' AND table_name = 'document_segment'
        ) AS has_document_segment,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'casework' AND table_name = 'document_representation_selection'
        ) AS has_document_representation_selection,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'casework' AND table_name = 'document_representation_comparison'
        ) AS has_document_representation_comparison
    `,
  );
  const row = result.rows[0] ?? {};
  if (
    !row.has_processing_job
    || !row.has_document_representation
    || !row.has_document_segment
    || !row.has_document_representation_selection
    || !row.has_document_representation_comparison
  ) {
    throw new Error("Phase C3 processing schema is not available in the target database");
  }
}
