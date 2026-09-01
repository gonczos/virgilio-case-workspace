import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  buildProcessingRuntimeEnv,
  ensureDir,
  EXTRACTOR_PATH,
  getWorkspaceRoot,
  PROCESSING_OUTPUT_ROOT,
  PYTHON_PATH,
  slugify,
} from "./processing-common.mjs";
import {
  extractPdfLiteralTextArtifact,
  extractPdfSignatureMetadataArtifact,
  extractPdfStructureInventoryArtifact,
  readArtifactJson,
} from "./pdf-evidence.mjs";

export const EXTRACT_STAGE_KEY = "EXTRACT_STRUCTURE";
export const HUMAN_STAGE_KEY = "HUMAN_CREATE_REPRESENTATION";
export const DEFAULT_REPRESENTATION_KIND = "extracted_document_bundle";
export const PDF_LITERAL_TEXT_REPRESENTATION_KIND = "pdf_literal_text";
export const PDF_SIGNATURE_METADATA_REPRESENTATION_KIND = "pdf_signature_metadata";
export const PDF_STRUCTURE_INVENTORY_REPRESENTATION_KIND = "pdf_structure_inventory";
export const PDF_OCR_TEXT_REPRESENTATION_KIND = "pdf_ocr_text";
export const DOCLING_PROFILE_KEY = "docling-preserve-furniture-v2";
export const XBERG_PROFILE_KEY = "xberg-preserve-furniture-v2";
export const PLAIN_TEXT_PROFILE_KEY = "plain-text-default-v1";
export const PDF_OCR_EVIDENCE_PROFILE_KEY = "docling-ocr-evidence-v1";
export const DOCLING_PROCESSOR_VERSION = "2.123.1-c5.2";
export const XBERG_PROCESSOR_VERSION = "1.0.14-c5.2";
export const PDF_LITERAL_TEXT_PROCESSOR_VERSION = "poppler-layout-v1-c5.3.1";
export const PDF_SIGNATURE_METADATA_PROCESSOR_VERSION = "qpdf-signature-v1-c5.3.1";
export const PDF_STRUCTURE_INVENTORY_PROCESSOR_VERSION = "qpdf-structure-v1-c5.3.1";
export const PDF_OCR_TEXT_PROCESSOR_VERSION = "docling-force-ocr-v1-c5.3.1";

function determineOcrMode(binaryRow) {
  if (binaryRow.mime_type === "text/plain" || binaryRow.file_extension === ".txt") {
    return "never";
  }
  if (binaryRow.machine_readability_status === "text_pdf" || binaryRow.machine_readability_status === "mixed_pdf") {
    return "never";
  }
  return "force";
}

function isPdfBinary(binaryRow) {
  return binaryRow.mime_type === "application/pdf" || binaryRow.file_extension === ".pdf";
}

function shouldRunPdfOcrEvidence(binaryRow) {
  return isPdfBinary(binaryRow)
    && (
      binaryRow.machine_readability_status === "image_only_pdf"
      || binaryRow.machine_readability_status === "mostly_image_pdf"
    );
}

async function runExtractor({
  workspaceRoot,
  engine,
  inputPath,
  artifactDir,
  profileKey,
  ocrMode,
  timeoutMs = 900000,
}) {
  await ensureDir(artifactDir);
  const pythonPath = path.join(workspaceRoot, PYTHON_PATH);
  const extractorPath = path.join(workspaceRoot, EXTRACTOR_PATH);
  return new Promise((resolve, reject) => {
    const child = spawn(
      pythonPath,
      [
        extractorPath,
        "--engine",
        engine,
        "--input-path",
        inputPath,
        "--artifact-dir",
        artifactDir,
        "--profile-key",
        profileKey,
        "--ocr-mode",
        ocrMode,
      ],
      {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: buildProcessingRuntimeEnv(workspaceRoot),
      },
    );
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

async function finalizeArtifactDir(outputDir, tempDir) {
  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDir(path.dirname(outputDir));
  await fs.cp(tempDir, outputDir, { recursive: true });
}

function buildMachineMetadata(binaryRow, extraction) {
  return {
    engine_version: extraction.processor_version,
    profile_key: extraction.profile_key,
    ocr_mode: extraction.ocr_mode,
    summary: extraction.summary,
    native_summary: extraction.native_summary,
    artifact_files: extraction.artifact_files,
    text_artifact: extraction.text_artifact,
    complete_text_artifact: extraction.complete_text_artifact ?? null,
    markdown_artifact: extraction.markdown_artifact ?? null,
    source_binary: {
      sha256: binaryRow.sha256,
      machine_readability_status: binaryRow.machine_readability_status,
      page_count: binaryRow.page_count,
      mime_type: binaryRow.mime_type,
      file_extension: binaryRow.file_extension,
    },
  };
}

function buildMachineContent(textContent, markdownContent, extraction) {
  return {
    text_length: textContent.length,
    complete_text_length: extraction.summary.complete_text_length ?? null,
    markdown_length: markdownContent.length,
    page_count: extraction.summary.page_count ?? null,
    table_count: extraction.summary.table_count ?? null,
    ocr_element_count: extraction.summary.ocr_element_count ?? null,
    quality_score: extraction.summary.quality_score ?? null,
    extraction_confidence: extraction.summary.extraction_confidence ?? null,
    extraction_method: extraction.summary.extraction_method ?? null,
  };
}

function buildSingleSegment(textContent, extraction) {
  return [
    {
      segment_kind: "document_text",
      sequence_no: 1,
      text_content: textContent,
      structural_path: null,
      page_no: null,
      char_start: 0,
      char_end: textContent.length,
      metadata_json: {
        source: extraction.text_artifact,
        profile_key: extraction.profile_key,
        ocr_mode: extraction.ocr_mode,
      },
    },
  ];
}

function createPythonProcessor({
  key,
  version,
  profileKey,
  formatFamily,
  representationKind = DEFAULT_REPRESENTATION_KIND,
  engine = null,
  determineOcrModeForBinary = determineOcrMode,
  selectTextArtifact = (extraction) => extraction.text_artifact ?? null,
  supportsBinary,
}) {
  return {
    key,
    version,
    profileKey,
    representationKind,
    formatFamily,
    supportsBinary,
    async execute({ workspaceRoot, binaryRow, materializedBinary, tempArtifactDir, outputRoot }) {
      if (!materializedBinary?.localPath) {
        throw new Error(`Processor ${key} did not receive a local materialized binary path`);
      }
      const extraction = await runExtractor({
        workspaceRoot,
        engine: engine ?? (key === "plain_text_passthrough" ? "plain_text" : key),
        inputPath: materializedBinary.localPath,
        artifactDir: tempArtifactDir,
        profileKey,
        ocrMode: determineOcrModeForBinary(binaryRow),
      });
      const selectedTextArtifact = selectTextArtifact(extraction);
      const textContent = selectedTextArtifact
        ? await fs.readFile(path.join(tempArtifactDir, selectedTextArtifact), "utf8")
        : "";
      const markdownContent = extraction.markdown_artifact
        ? await fs.readFile(path.join(tempArtifactDir, extraction.markdown_artifact), "utf8")
        : "";
      const outputDir = path.join(
        outputRoot,
        slugify(key),
        version,
        binaryRow.sha256,
      );
      await finalizeArtifactDir(outputDir, tempArtifactDir);
      const workspaceRootResolved = workspaceRoot || getWorkspaceRoot();
      return {
        processorKey: key,
        processorVersion: version,
        representationKind,
        formatFamily,
        artifactRelPath: path.relative(workspaceRootResolved, outputDir).replace(/\\/gu, "/"),
        metadataJson: buildMachineMetadata(binaryRow, extraction),
        contentJson: buildMachineContent(textContent, markdownContent, extraction),
        segments: selectedTextArtifact ? buildSingleSegment(textContent, {
          ...extraction,
          text_artifact: selectedTextArtifact,
        }) : [],
        summary: extraction.summary,
      };
    },
  };
}

function createPdfEvidenceProcessor({
  key,
  version,
  representationKind,
  executeEvidence,
}) {
  return {
    key,
    version,
    profileKey: version,
    representationKind,
    formatFamily: "pdf",
    supportsBinary(binaryRow) {
      return isPdfBinary(binaryRow);
    },
    async execute({ workspaceRoot, binaryRow, materializedBinary, tempArtifactDir, outputRoot }) {
      if (!materializedBinary?.localPath) {
        throw new Error(`Processor ${key} did not receive a local materialized binary path`);
      }
      await executeEvidence({
        workspaceRoot,
        inputPath: materializedBinary.localPath,
        artifactDir: tempArtifactDir,
        binaryRow,
      });
      const nativeArtifact = await readArtifactJson(tempArtifactDir);
      const hasTextArtifact = nativeArtifact.artifact_kind === "pdf-literal-text";
      const textContent = hasTextArtifact
        ? await fs.readFile(path.join(tempArtifactDir, "text.txt"), "utf8")
        : "";
      const outputDir = path.join(outputRoot, slugify(key), version, binaryRow.sha256);
      await finalizeArtifactDir(outputDir, tempArtifactDir);
      const workspaceRootResolved = workspaceRoot || getWorkspaceRoot();
      return {
        processorKey: key,
        processorVersion: version,
        representationKind,
        formatFamily: "pdf",
        artifactRelPath: path.relative(workspaceRootResolved, outputDir).replace(/\\/gu, "/"),
        metadataJson: {
          artifact_kind: nativeArtifact.artifact_kind,
          source_binary: nativeArtifact.source_binary,
          extractor: nativeArtifact.extractor ?? null,
          extractors: nativeArtifact.extractors ?? null,
        },
        contentJson: hasTextArtifact
          ? { text_length: textContent.length }
          : {
              signature_count: nativeArtifact.signatures?.length ?? null,
              channels_present: Object.fromEntries(
                Object.entries(nativeArtifact.channels ?? {}).map(([name, value]) => [name, value?.status ?? null]),
              ),
            },
        segments: hasTextArtifact
          ? buildSingleSegment(textContent, {
            text_artifact: "text.txt",
            profile_key: version,
            ocr_mode: "never",
          })
          : [],
        summary: nativeArtifact,
      };
    },
  };
}

const BUILTIN_PROCESSORS = [
  createPdfEvidenceProcessor({
    key: "pdf_literal_text",
    version: PDF_LITERAL_TEXT_PROCESSOR_VERSION,
    representationKind: PDF_LITERAL_TEXT_REPRESENTATION_KIND,
    executeEvidence: extractPdfLiteralTextArtifact,
  }),
  createPdfEvidenceProcessor({
    key: "pdf_signature_metadata",
    version: PDF_SIGNATURE_METADATA_PROCESSOR_VERSION,
    representationKind: PDF_SIGNATURE_METADATA_REPRESENTATION_KIND,
    executeEvidence: extractPdfSignatureMetadataArtifact,
  }),
  createPdfEvidenceProcessor({
    key: "pdf_structure_inventory",
    version: PDF_STRUCTURE_INVENTORY_PROCESSOR_VERSION,
    representationKind: PDF_STRUCTURE_INVENTORY_REPRESENTATION_KIND,
    executeEvidence: extractPdfStructureInventoryArtifact,
  }),
  createPythonProcessor({
    key: "docling",
    version: DOCLING_PROCESSOR_VERSION,
    profileKey: DOCLING_PROFILE_KEY,
    formatFamily: "pdf",
    supportsBinary: isPdfBinary,
  }),
  createPythonProcessor({
    key: "xberg",
    version: XBERG_PROCESSOR_VERSION,
    profileKey: XBERG_PROFILE_KEY,
    formatFamily: "pdf",
    supportsBinary: isPdfBinary,
  }),
  createPythonProcessor({
    key: "pdf_ocr_text",
    version: PDF_OCR_TEXT_PROCESSOR_VERSION,
    profileKey: PDF_OCR_EVIDENCE_PROFILE_KEY,
    formatFamily: "pdf",
    representationKind: PDF_OCR_TEXT_REPRESENTATION_KIND,
    engine: "docling_ocr_evidence",
    determineOcrModeForBinary() {
      return "force";
    },
    supportsBinary: shouldRunPdfOcrEvidence,
  }),
  createPythonProcessor({
    key: "plain_text_passthrough",
    version: "builtin-v1",
    profileKey: PLAIN_TEXT_PROFILE_KEY,
    formatFamily: "text",
    supportsBinary(binaryRow) {
      return binaryRow.mime_type === "text/plain" || binaryRow.file_extension === ".txt";
    },
  }),
];

export function listBuiltinProcessors() {
  return [...BUILTIN_PROCESSORS];
}

export function getProcessor(processorKey, registry = BUILTIN_PROCESSORS) {
  const processor = registry.find((candidate) => candidate.key === processorKey);
  if (!processor) {
    throw new Error(`Unknown processor: ${processorKey}`);
  }
  return processor;
}

export function determineProcessingPolicy(binaryRow, registry = BUILTIN_PROCESSORS) {
  return registry.filter((processor) => processor.supportsBinary(binaryRow));
}

export function getProcessingOutputRoot(workspaceRoot = getWorkspaceRoot()) {
  return path.join(workspaceRoot, PROCESSING_OUTPUT_ROOT);
}
