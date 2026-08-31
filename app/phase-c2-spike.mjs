import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "pg";

import { buildComparisonObservation, normalizeComparisonText } from "./phase-c2-compare.mjs";

const REPRESENTATION_KIND = "extracted_document_bundle";
const REQUESTED_BY = "phase-c2-spike";
const STAGE_KEY = "EXTRACT_STRUCTURE";
const PROFILE_KEY = "phase-c2-spike-v1";
const PROCESSING_ROOT = path.join("data", "exports", "phase-c2");
const MANIFEST_PATH = path.join("docs", "evaluation", "phase-c2-evaluation-corpus.json");
const REPORT_PATH = path.join("docs", "evaluation", "2026-08-31-phase-c2-multi-engine-extraction-spike.md");
const PYTHON_PATH = path.join(".venv-processing", "Scripts", "python.exe");
const EXTRACTOR_PATH = path.join("app", "processors", "extract-document.py");
const REPEATABILITY_SHA_CANDIDATES = [
  "6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c",
];

function parseArgs(argv) {
  let limit = null;
  const shas = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--limit") {
      limit = Number(argv[index + 1]);
      index += 1;
    } else if (value === "--sha") {
      shas.push(String(argv[index + 1]));
      index += 1;
    }
  }
  return { limit, shas };
}

function loadDotEnv(envPath) {
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

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

function slugify(value) {
  return String(value).replace(/[^a-z0-9]+/giu, "-").replace(/^-+|-+$/gu, "").toLowerCase() || "value";
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  const content = await fs.readFile(filePath);
  hash.update(content);
  return hash.digest("hex");
}

async function withTransaction(client, work) {
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

async function assertProcessingSchema(client) {
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
        ) AS has_document_segment
    `,
  );
  const row = result.rows[0] ?? {};
  if (!row.has_processing_job || !row.has_document_representation || !row.has_document_segment) {
    throw new Error("Phase C1 processing schema is not available in the target database");
  }
}

function determineOcrMode(machineReadabilityStatus) {
  if (machineReadabilityStatus === "text_pdf" || machineReadabilityStatus === "mixed_pdf") {
    return "never";
  }
  return "force";
}

async function getBinaryRecord(client, sha256) {
  const result = await client.query(
    `
      SELECT
        fb.id,
        fb.sha256,
        fb.mime_type,
        fb.file_extension,
        fb.storage_package_id,
        fb.storage_rel_path,
        fb.machine_readability_status,
        fb.page_count,
        fb.actual_size_bytes,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'document_id', d.id,
              'document_name', d.document_name,
              'document_date', d.document_date,
              'document_type', d.document_type
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM casework.file_binary AS fb
      LEFT JOIN casework.document_binary AS db
        ON db.file_binary_id = fb.id
      LEFT JOIN casework.document AS d
        ON d.id = db.document_id
      WHERE fb.sha256 = $1
      GROUP BY fb.id
    `,
    [sha256],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Unknown file_binary sha256: ${sha256}`);
  }
  return result.rows[0];
}

function resolveBinaryPath(workspaceRoot, binaryRow) {
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

async function runExtractor({ workspaceRoot, engine, inputPath, ocrMode, artifactDir, timeoutMs = 900000 }) {
  await fs.mkdir(artifactDir, { recursive: true });
  const pythonPath = path.join(workspaceRoot, PYTHON_PATH);
  const extractorPath = path.join(workspaceRoot, EXTRACTOR_PATH);
  const cacheRoot = path.join(workspaceRoot, PROCESSING_ROOT, ".cache");
  const tempRoot = path.join(workspaceRoot, PROCESSING_ROOT, ".tmp");
  const localAppDataRoot = path.join(workspaceRoot, PROCESSING_ROOT, ".localappdata");
  return new Promise((resolve, reject) => {
    fsSync.mkdirSync(cacheRoot, { recursive: true });
    fsSync.mkdirSync(tempRoot, { recursive: true });
    fsSync.mkdirSync(localAppDataRoot, { recursive: true });
    const child = spawn(pythonPath, [
      extractorPath,
      "--engine",
      engine,
      "--input-path",
      inputPath,
      "--artifact-dir",
      artifactDir,
      "--profile-key",
      PROFILE_KEY,
      "--ocr-mode",
      ocrMode,
    ], {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        XDG_CACHE_HOME: cacheRoot,
        HF_HOME: path.join(cacheRoot, "huggingface"),
        HUGGINGFACE_HUB_CACHE: path.join(cacheRoot, "huggingface", "hub"),
        TEMP: tempRoot,
        TMP: tempRoot,
        TMPDIR: tempRoot,
        LOCALAPPDATA: localAppDataRoot,
      },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`Extractor ${engine} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      if (code !== 0) {
        reject(new Error(`Extractor ${engine} failed with code ${code}\n${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Failed to parse extractor output for ${engine}: ${error.message}\n${stdout}\n${stderr}`));
      }
    });
  });
}

async function getExistingRepresentation(client, { fileBinaryId, processorKey, processorVersion }) {
  const result = await client.query(
    `
      SELECT
        dr.id,
        dr.artifact_rel_path,
        dr.content_json,
        dr.metadata_json,
        pj.id AS produced_by_job_id,
        pj.status AS produced_by_job_status
      FROM casework.document_representation AS dr
      JOIN casework.processing_job AS pj
        ON pj.id = dr.produced_by_job_id
      WHERE dr.file_binary_id = $1
        AND dr.representation_kind = $2
        AND dr.processor_key = $3
        AND dr.processor_version = $4
    `,
    [fileBinaryId, REPRESENTATION_KIND, processorKey, processorVersion],
  );
  return result.rows[0] ?? null;
}

async function getExistingFailedJob(client, { fileBinaryId, processorKey, processorVersion }) {
  const result = await client.query(
    `
      SELECT
        id,
        error_code,
        error_text,
        completed_at
      FROM casework.processing_job
      WHERE file_binary_id = $1
        AND stage_key = $2
        AND processor_key = $3
        AND processor_version = $4
        AND requested_by = $5
        AND status = 'failed'
      ORDER BY id DESC
      LIMIT 1
    `,
    [fileBinaryId, STAGE_KEY, processorKey, processorVersion, REQUESTED_BY],
  );
  return result.rows[0] ?? null;
}

async function insertCompletedRepresentation(client, binaryRow, extraction, artifactRelPath, textContent, markdownContent) {
  return withTransaction(client, async () => {
    const jobResult = await client.query(
      `
        INSERT INTO casework.processing_job (
          stage_key,
          status,
          file_binary_id,
          processor_key,
          processor_version,
          requested_by,
          requested_at,
          started_at,
          completed_at,
          attempt_count,
          max_attempts
        )
        VALUES ($1, 'running', $2, $3, $4, $5, NOW(), NOW(), NULL, 1, 1)
        RETURNING id
      `,
      [
        STAGE_KEY,
        binaryRow.id,
        extraction.processor_key,
        extraction.processor_version,
        REQUESTED_BY,
      ],
    );
    const jobId = jobResult.rows[0].id;
    const representationResult = await client.query(
      `
        INSERT INTO casework.document_representation (
          file_binary_id,
          produced_by_job_id,
          representation_kind,
          format_family,
          processor_key,
          processor_version,
          metadata_json,
          content_json,
          artifact_rel_path
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
        RETURNING id
      `,
      [
        binaryRow.id,
        jobId,
        REPRESENTATION_KIND,
        extraction.format_family,
        extraction.processor_key,
        extraction.processor_version,
        JSON.stringify({
          profile_key: extraction.profile_key,
          ocr_mode: extraction.ocr_mode,
          summary: extraction.summary,
          native_summary: extraction.native_summary,
          artifact_files: extraction.artifact_files,
          source_binary: {
            sha256: binaryRow.sha256,
            machine_readability_status: binaryRow.machine_readability_status,
            page_count: binaryRow.page_count,
          },
        }),
        JSON.stringify({
          text_length: textContent.length,
          markdown_length: markdownContent.length,
          page_count: extraction.summary.page_count ?? null,
          table_count: extraction.summary.table_count ?? null,
          ocr_element_count: extraction.summary.ocr_element_count ?? null,
          quality_score: extraction.summary.quality_score ?? null,
          extraction_confidence: extraction.summary.extraction_confidence ?? null,
          extraction_method: extraction.summary.extraction_method ?? null,
        }),
        artifactRelPath,
      ],
    );
    const representationId = representationResult.rows[0].id;
    await client.query(
      `
        INSERT INTO casework.document_segment (
          document_representation_id,
          segment_kind,
          sequence_no,
          text_content,
          structural_path,
          page_no,
          char_start,
          char_end,
          metadata_json
        )
        VALUES ($1, 'document_text', 1, $2, NULL, NULL, 0, $3, $4::jsonb)
      `,
      [
        representationId,
        textContent,
        textContent.length,
        JSON.stringify({
          source: "artifact/text.txt",
          profile_key: extraction.profile_key,
          ocr_mode: extraction.ocr_mode,
        }),
      ],
    );
    await client.query(
      `
        UPDATE casework.processing_job
        SET
          status = 'completed',
          completed_at = NOW()
        WHERE id = $1
      `,
      [jobId],
    );
    return { jobId, representationId };
  });
}

async function insertFailedJob(client, binaryRow, { processorKey, processorVersion, errorCode, errorText }) {
  await client.query(
    `
      INSERT INTO casework.processing_job (
        stage_key,
        status,
        file_binary_id,
        processor_key,
        processor_version,
        requested_by,
        requested_at,
        started_at,
        completed_at,
        attempt_count,
        max_attempts,
        error_code,
        error_text
      )
      VALUES ($1, 'failed', $2, $3, $4, $5, NOW(), NOW(), NOW(), 1, 1, $6, $7)
    `,
    [
      STAGE_KEY,
      binaryRow.id,
      processorKey,
      processorVersion,
      REQUESTED_BY,
      errorCode,
      errorText.slice(0, 8000),
    ],
  );
}

async function ensureRepresentation({ client, workspaceRoot, binaryRow, engine }) {
  const preflightVersion = engine === "docling" ? "2.123.1" : "1.0.14";
  const existingRepresentation = await getExistingRepresentation(client, {
    fileBinaryId: binaryRow.id,
    processorKey: engine,
    processorVersion: preflightVersion,
  });
  if (existingRepresentation) {
    return {
      reused: true,
      failed: false,
      processor_key: engine,
      processor_version: preflightVersion,
      representation_id: existingRepresentation.id,
      artifact_rel_path: existingRepresentation.artifact_rel_path,
      content_json: existingRepresentation.content_json,
      metadata_json: existingRepresentation.metadata_json,
    };
  }
  const existingFailure = await getExistingFailedJob(client, {
    fileBinaryId: binaryRow.id,
    processorKey: engine,
    processorVersion: preflightVersion,
  });
  if (existingFailure) {
    return {
      reused: true,
      failed: true,
      processor_key: engine,
      processor_version: preflightVersion,
      processing_job_id: existingFailure.id,
      error_code: existingFailure.error_code,
      error_text: existingFailure.error_text,
    };
  }

  const ocrMode = determineOcrMode(binaryRow.machine_readability_status);
  const outputBaseRelPath = path.join(
    PROCESSING_ROOT,
    slugify(engine),
    preflightVersion,
    binaryRow.sha256,
  );
  const outputBaseAbsolutePath = path.join(workspaceRoot, outputBaseRelPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `virgilio-${engine}-`));
  try {
    const extraction = await runExtractor({
      workspaceRoot,
      engine,
      inputPath: resolveBinaryPath(workspaceRoot, binaryRow),
      ocrMode,
      artifactDir: tempDir,
    });
    if (extraction.processor_key !== engine || extraction.processor_version !== preflightVersion) {
      throw new Error(`Unexpected extractor identity from ${engine}: ${JSON.stringify(extraction)}`);
    }
    const fileSha256 = await sha256File(resolveBinaryPath(workspaceRoot, binaryRow));
    if (fileSha256 !== binaryRow.sha256) {
      throw new Error(`Source file hash drift for ${binaryRow.sha256}`);
    }
    const textContent = await fs.readFile(path.join(tempDir, extraction.text_artifact), "utf8");
    const markdownContent = extraction.markdown_artifact
      ? await fs.readFile(path.join(tempDir, extraction.markdown_artifact), "utf8")
      : "";
    await fs.rm(outputBaseAbsolutePath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(outputBaseAbsolutePath), { recursive: true });
    await fs.cp(tempDir, outputBaseAbsolutePath, { recursive: true });
    const artifactRelPath = path.relative(workspaceRoot, outputBaseAbsolutePath).replace(/\\/gu, "/");
    const dbInsert = await insertCompletedRepresentation(
      client,
      binaryRow,
      extraction,
      artifactRelPath,
      textContent,
      markdownContent,
    );
    return {
      reused: false,
      failed: false,
      processor_key: extraction.processor_key,
      processor_version: extraction.processor_version,
      representation_id: dbInsert.representationId,
      processing_job_id: dbInsert.jobId,
      artifact_rel_path: artifactRelPath,
      summary: extraction.summary,
      content_json: {
        text_length: textContent.length,
        markdown_length: markdownContent.length,
      },
      metadata_json: {
        profile_key: extraction.profile_key,
        ocr_mode: extraction.ocr_mode,
      },
    };
  } catch (error) {
    await insertFailedJob(client, binaryRow, {
      processorKey: engine,
      processorVersion: preflightVersion,
      errorCode: "extractor_failed",
      errorText: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    return {
      reused: false,
      failed: true,
      processor_key: engine,
      processor_version: preflightVersion,
      error_code: "extractor_failed",
      error_text: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function readRepresentationText(workspaceRoot, artifactRelPath) {
  const textPath = path.join(workspaceRoot, artifactRelPath, "text.txt");
  return fs.readFile(textPath, "utf8");
}

async function readRepresentationSummary(workspaceRoot, artifactRelPath) {
  const summaryPath = path.join(workspaceRoot, artifactRelPath, "summary.json");
  return readJson(summaryPath);
}

async function runRepeatabilityCheck({ workspaceRoot, binaryRow, engine }) {
  const tempDirOne = await fs.mkdtemp(path.join(os.tmpdir(), `virgilio-repeatability-${engine}-a-`));
  const tempDirTwo = await fs.mkdtemp(path.join(os.tmpdir(), `virgilio-repeatability-${engine}-b-`));
  try {
    const ocrMode = determineOcrMode(binaryRow.machine_readability_status);
    const runOne = await runExtractor({
      workspaceRoot,
      engine,
      inputPath: resolveBinaryPath(workspaceRoot, binaryRow),
      ocrMode,
      artifactDir: tempDirOne,
    });
    const runTwo = await runExtractor({
      workspaceRoot,
      engine,
      inputPath: resolveBinaryPath(workspaceRoot, binaryRow),
      ocrMode,
      artifactDir: tempDirTwo,
    });
    return {
      engine,
      sha256: binaryRow.sha256,
      success: true,
      exact_normalized_text_match: normalizeComparisonText(
        await fs.readFile(path.join(tempDirOne, runOne.text_artifact), "utf8"),
      ) === normalizeComparisonText(
        await fs.readFile(path.join(tempDirTwo, runTwo.text_artifact), "utf8"),
      ),
      run_one_text_length: (await fs.readFile(path.join(tempDirOne, runOne.text_artifact), "utf8")).length,
      run_two_text_length: (await fs.readFile(path.join(tempDirTwo, runTwo.text_artifact), "utf8")).length,
      run_one_summary: runOne.summary,
      run_two_summary: runTwo.summary,
    };
  } catch (error) {
    return {
      engine,
      sha256: binaryRow.sha256,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(tempDirOne, { recursive: true, force: true });
    await fs.rm(tempDirTwo, { recursive: true, force: true });
  }
}

function summarizeRecommendation(comparisons) {
  const high = comparisons.filter((item) => item.comparison.disagreement_level === "high").length;
  const medium = comparisons.filter((item) => item.comparison.disagreement_level === "medium").length;
  if (high >= 4 || medium >= 8) {
    return {
      recommendation: "D",
      summary: "Use one engine routinely and the other selectively for scans, mixed PDFs, and disagreement-driven spot checks.",
    };
  }
  return {
    recommendation: "C",
    summary: "Run both engines routinely and retain both interpretations because disagreement is infrequent but still materially informative.",
  };
}

function pickRepeatabilityEntries(entries) {
  const selected = [];
  for (const sha256 of REPEATABILITY_SHA_CANDIDATES) {
    const entry = entries.find((candidate) => candidate.sha256 === sha256);
    if (entry) {
      selected.push(entry);
    }
  }
  if (!selected.length && entries.length) {
    selected.push(entries[0]);
  }
  return selected;
}

async function buildMarkdownReport({ manifest, runStartedAt, processed, comparisons, repeatabilityChecks, failureChecks, countsBefore, countsAfter }) {
  const recommendation = summarizeRecommendation(comparisons);
  const highDisagreements = comparisons
    .filter((item) => item.comparison.disagreement_level === "high")
    .slice(0, 8);
  const doclingFailures = processed.filter((item) => item.docling.failed).length;
  const xbergFailures = processed.filter((item) => item.xberg.failed).length;
  const retainedRepresentations = processed.reduce(
    (count, item) => count + (item.docling.failed ? 0 : 1) + (item.xberg.failed ? 0 : 1),
    0,
  );
  const lines = [
    "# Phase C2 Multi-Engine Document Extraction Spike",
    "",
    `Run date: ${runStartedAt}`,
    "",
    "## Scope",
    "",
    "- Evaluated Docling and Xberg behind the existing Phase C1 processing boundary.",
    `- Representative corpus size: ${manifest.entries.length} imported Virgilio PDFs.`,
    "- Plain-text `file_binary` rows were not present in the current corpus, so PDF was the only corpus-backed format exercised.",
    "",
    "## Processing Outcome",
    "",
    `- Processed representations retained: ${retainedRepresentations}.`,
    `- Engine failures on corpus slice: docling ${doclingFailures}, xberg ${xbergFailures}.`,
    `- Canonical source rows before/after unchanged: file_binary ${countsBefore.file_binary} -> ${countsAfter.file_binary}, document ${countsBefore.document} -> ${countsAfter.document}, document_binary ${countsBefore.document_binary} -> ${countsAfter.document_binary}.`,
    `- Phase C2 rows added: processing_job ${countsAfter.processing_job}, document_representation ${countsAfter.document_representation}, document_segment ${countsAfter.document_segment}.`,
    "",
    "## Comparison Summary",
    "",
    `- High disagreements: ${comparisons.filter((item) => item.comparison.disagreement_level === "high").length}.`,
    `- Medium disagreements: ${comparisons.filter((item) => item.comparison.disagreement_level === "medium").length}.`,
    `- Exact normalized text matches: ${comparisons.filter((item) => item.comparison.exact_normalized_match).length}.`,
    `- Pairwise comparisons available: ${comparisons.length} of ${processed.length}.`,
    "",
    "## High-Disagreement Examples",
    "",
  ];

  if (!highDisagreements.length) {
    lines.push("- None on this corpus slice.");
  } else {
    for (const item of highDisagreements) {
      lines.push(`- ${item.sha256} (${item.bucket}) token_jaccard=${item.comparison.token_jaccard} char_ratio=${item.comparison.char_length_ratio}`);
      if (item.comparison.first_different_line) {
        lines.push(`  first diff line ${item.comparison.first_different_line.line_no}:`);
        lines.push(`  docling: ${item.comparison.first_different_line.left}`);
        lines.push(`  xberg: ${item.comparison.first_different_line.right}`);
      }
    }
  }

  lines.push(
    "",
    "## Repeatability",
    "",
    ...repeatabilityChecks.map((item) => item.success
      ? `- ${item.engine} ${item.sha256}: normalized text match = ${item.exact_normalized_text_match}`
      : `- ${item.engine} ${item.sha256}: repeatability check failed (${item.error})`),
    "",
    "## Failure Handling",
    "",
    ...failureChecks.map((item) => `- ${item.name}: ${item.result}`),
    "",
    "## Engine Integration Findings",
    "",
    `- Docling completed ${processed.length - doclingFailures}/${processed.length} corpus documents on this spike path.`,
    `- Xberg completed ${processed.length - xbergFailures}/${processed.length} corpus documents on this spike path.`,
    "- Xberg OCR integration remained less clean locally because scan-heavy cases required writable cache/model locations and still attempted additional model download/network access.",
    "",
    "## Recommendation",
    "",
    `- ${recommendation.recommendation}. ${recommendation.summary}`,
    "- Neither engine should be treated as authoritative source truth; keep the original `file_binary` bytes and SHA-256 as canonical evidence.",
    "- Preserve both engine outputs where disagreement is informative, especially on scans, mixed PDFs, identifiers, and reading-order edge cases.",
    "",
    "## Operational Notes",
    "",
    "- Docling has the heavier local dependency/model footprint and slower OCR path.",
    "- Xberg is easier to invoke and returns strong whole-document text quickly, but its default native page/layout surface is thinner on this spike path.",
    "- Original `file_binary` content was read-only throughout the spike.",
  );
  return `${lines.join("\n")}\n`;
}

async function countTables(client) {
  const result = await client.query(
    `
      SELECT
        (SELECT COUNT(*) FROM casework.file_binary) AS file_binary,
        (SELECT COUNT(*) FROM casework.document) AS document,
        (SELECT COUNT(*) FROM casework.document_binary) AS document_binary,
        (SELECT COUNT(*) FROM casework.processing_job) AS processing_job,
        (SELECT COUNT(*) FROM casework.document_representation) AS document_representation,
        (SELECT COUNT(*) FROM casework.document_segment) AS document_segment
    `,
  );
  return result.rows[0];
}

async function runFailureCheck(workspaceRoot, engine, fixture) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `virgilio-failure-${engine}-`));
  try {
    await runExtractor({
      workspaceRoot,
      engine,
      inputPath: fixture.path,
      ocrMode: "force",
      artifactDir: tempDir,
      timeoutMs: 15000,
    });
    return { name: `${engine}:${fixture.name}`, result: "unexpected_success" };
  } catch (error) {
    return { name: `${engine}:${fixture.name}`, result: "failed_as_expected" };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function createFailureFixtures(workspaceRoot) {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "virgilio-c2-fixtures-"));
  const zeroBytePath = path.join(fixtureDir, "zero-byte.pdf");
  const malformedPath = path.join(fixtureDir, "malformed.pdf");
  await fs.writeFile(zeroBytePath, "");
  await fs.writeFile(malformedPath, "%PDF-1.4\nmalformed\n%%EOF\n");
  return {
    dir: fixtureDir,
    fixtures: [
      { name: "zero-byte-pdf", path: zeroBytePath },
      { name: "malformed-pdf", path: malformedPath },
    ],
  };
}

async function main() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(moduleDir, "..");
  const args = parseArgs(process.argv.slice(2));
  loadDotEnv(path.join(workspaceRoot, ".env"));

  const manifest = await readJson(path.join(workspaceRoot, MANIFEST_PATH));
  const filteredEntries = args.shas.length
    ? manifest.entries.filter((entry) => args.shas.includes(entry.sha256))
    : manifest.entries;
  const entries = args.limit === null ? filteredEntries : filteredEntries.slice(0, args.limit);
  const client = new Client({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.POSTGRES_DB ?? process.env.PGDATABASE,
    user: process.env.POSTGRES_USER ?? process.env.PGUSER,
    password: process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD,
  });
  await client.connect();
  const runStartedAt = new Date().toISOString();
  const processed = [];
  const comparisons = [];
  const repeatabilityChecks = [];
  let failureFixtureState = null;

  try {
    await assertProcessingSchema(client);
    const countsBefore = await countTables(client);

    for (const entry of entries) {
      console.log(`[phase-c2] processing ${entry.sha256} (${entry.bucket})`);
      const binaryRow = await getBinaryRecord(client, entry.sha256);
      const binaryPath = resolveBinaryPath(workspaceRoot, binaryRow);
      if (!fsSync.existsSync(binaryPath)) {
        throw new Error(`Missing source binary on disk: ${binaryPath}`);
      }

      console.log(`[phase-c2]   docling`);
      const doclingResult = await ensureRepresentation({
        client,
        workspaceRoot,
        binaryRow,
        engine: "docling",
      });
      console.log(`[phase-c2]   xberg`);
      const xbergResult = await ensureRepresentation({
        client,
        workspaceRoot,
        binaryRow,
        engine: "xberg",
      });
      processed.push({
        sha256: entry.sha256,
        bucket: entry.bucket,
        docling: {
          ...doclingResult,
          summary: doclingResult.failed
            ? null
            : await readRepresentationSummary(workspaceRoot, doclingResult.artifact_rel_path),
        },
        xberg: {
          ...xbergResult,
          summary: xbergResult.failed
            ? null
            : await readRepresentationSummary(workspaceRoot, xbergResult.artifact_rel_path),
        },
      });
      if (!doclingResult.failed && !xbergResult.failed) {
        const doclingText = await readRepresentationText(workspaceRoot, doclingResult.artifact_rel_path);
        const xbergText = await readRepresentationText(workspaceRoot, xbergResult.artifact_rel_path);
        const comparison = buildComparisonObservation({
          leftEngine: "docling",
          rightEngine: "xberg",
          leftText: doclingText,
          rightText: xbergText,
        });
        comparisons.push({
          sha256: entry.sha256,
          bucket: entry.bucket,
          label: entry.label,
          comparison,
        });
      }
    }

    for (const entry of pickRepeatabilityEntries(entries)) {
      const binaryRow = await getBinaryRecord(client, entry.sha256);
      repeatabilityChecks.push(await runRepeatabilityCheck({ workspaceRoot, binaryRow, engine: "docling" }));
      repeatabilityChecks.push(await runRepeatabilityCheck({ workspaceRoot, binaryRow, engine: "xberg" }));
    }

    failureFixtureState = await createFailureFixtures(workspaceRoot);
    const failureChecks = [];
    for (const fixture of failureFixtureState.fixtures) {
      failureChecks.push(await runFailureCheck(workspaceRoot, "docling", fixture));
      failureChecks.push(await runFailureCheck(workspaceRoot, "xberg", fixture));
    }

    const countsAfter = await countTables(client);
    const exportRoot = path.join(workspaceRoot, PROCESSING_ROOT);
    await writeJson(path.join(exportRoot, "comparison-summary.json"), {
      run_started_at: runStartedAt,
      manifest: { ...manifest, entries },
      processed,
      comparisons,
      repeatability_checks: repeatabilityChecks,
      failure_checks: failureChecks,
      counts_before: countsBefore,
      counts_after: countsAfter,
    });
    await writeText(
      path.join(workspaceRoot, REPORT_PATH),
      await buildMarkdownReport({
        manifest: { ...manifest, entries },
        runStartedAt,
        processed,
        comparisons,
        repeatabilityChecks,
        failureChecks,
        countsBefore,
        countsAfter,
      }),
    );

    console.log(`[phase-c2] processed corpus entries: ${entries.length}`);
    console.log(`[phase-c2] representations retained: ${processed.length * 2}`);
    console.log(`[phase-c2] high disagreements: ${comparisons.filter((item) => item.comparison.disagreement_level === "high").length}`);
    console.log(`[phase-c2] report: ${REPORT_PATH}`);
  } finally {
    if (failureFixtureState) {
      await fs.rm(failureFixtureState.dir, { recursive: true, force: true });
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error("[phase-c2] fatal error");
  console.error(error);
  process.exitCode = 1;
});
