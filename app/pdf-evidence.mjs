import path from "node:path";
import { spawn } from "node:child_process";

import {
  readJson,
  writeJson,
  writeText,
} from "./processing-common.mjs";

const DEFAULT_TIMEOUT_MS = 120000;
const TOOL_VERSION_CACHE = new Map();

function buildProcessorTimeoutError(command, args, timeoutMs) {
  const error = new Error(`Command timed out: ${command} ${args.join(" ")}`);
  error.code = "processor_timeout";
  error.timeout_ms = timeoutMs;
  error.command = command;
  return error;
}

function firstNonEmptyLine(value) {
  return String(value ?? "")
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function stripQpdfPrefix(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (value.startsWith("u:") || value.startsWith("b:")) {
    return value.slice(2);
  }
  return value;
}

function normalizeQpdfValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeQpdfValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeQpdfValue(item)]),
    );
  }
  return stripQpdfPrefix(value);
}

function parsePdfInfoOutput(output) {
  const result = {};
  for (const line of String(output ?? "").split(/\r?\n/gu)) {
    const match = line.match(/^([^:]+):\s*(.*)$/u);
    if (!match) {
      continue;
    }
    result[match[1].trim().toLowerCase().replace(/\s+/gu, "_")] = match[2].trim();
  }
  return result;
}

function parseBooleanField(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") {
    return true;
  }
  if (normalized === "no") {
    return false;
  }
  return null;
}

function triState(status, detail = null) {
  return detail === null ? { status } : { status, detail };
}

function mergeQpdfObjectEntries(entries) {
  const merged = {};
  for (const entry of entries ?? []) {
    for (const [key, value] of Object.entries(entry ?? {})) {
      merged[key] = value;
    }
  }
  return merged;
}

function buildQpdfObjectMap(qpdfJson) {
  return mergeQpdfObjectEntries(qpdfJson?.qpdf?.slice(1) ?? []);
}

function getObjectEntry(objectMap, ref) {
  if (!ref) {
    return null;
  }
  return objectMap[`obj:${ref}`] ?? null;
}

function getObjectValue(objectMap, ref) {
  const entry = getObjectEntry(objectMap, ref);
  if (!entry) {
    return null;
  }
  if (entry.value) {
    return normalizeQpdfValue(entry.value);
  }
  if (entry.stream?.dict) {
    return normalizeQpdfValue(entry.stream.dict);
  }
  return normalizeQpdfValue(entry);
}

function parsePdfDate(rawValue) {
  if (!rawValue) {
    return null;
  }
  const normalized = String(rawValue).trim();
  if (!normalized.startsWith("D:")) {
    return normalized;
  }
  return normalized.slice(2);
}

async function runCli(command, args, {
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  acceptedExitCodes = [0],
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject(buildProcessorTimeoutError(command, args, timeoutMs));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
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
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (!acceptedExitCodes.includes(code ?? 0)) {
        reject(new Error(`Command failed with code ${code}: ${command} ${args.join(" ")}\n${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function getToolVersion(command, args, {
  cwd,
  readFrom = "stdout",
  acceptedExitCodes = [0],
} = {}) {
  const cacheKey = `${command}\u0000${args.join("\u0000")}\u0000${readFrom}`;
  if (TOOL_VERSION_CACHE.has(cacheKey)) {
    return TOOL_VERSION_CACHE.get(cacheKey);
  }
  const { stdout, stderr } = await runCli(command, args, { cwd, acceptedExitCodes });
  const raw = readFrom === "stderr" ? stderr : stdout;
  const version = firstNonEmptyLine(raw);
  TOOL_VERSION_CACHE.set(cacheKey, version);
  return version;
}

async function runPdftotext(inputPath, workspaceRoot, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const toolVersion = await getToolVersion("pdftotext", ["-v"], {
    cwd: workspaceRoot,
    readFrom: "stderr",
    acceptedExitCodes: [0, 99],
  });
  const { stdout } = await runCli("pdftotext", ["-layout", "-enc", "UTF-8", inputPath, "-"], {
    cwd: workspaceRoot,
    timeoutMs,
  });
  return {
    toolVersion,
    text: stdout.replace(/^\uFEFF/gu, ""),
    args: ["-layout", "-enc", "UTF-8", "<input>", "-"],
  };
}

async function runPdfinfo(inputPath, workspaceRoot, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const toolVersion = await getToolVersion("pdfinfo", ["-v"], {
    cwd: workspaceRoot,
    readFrom: "stderr",
    acceptedExitCodes: [0, 99],
  });
  const { stdout } = await runCli("pdfinfo", [inputPath], { cwd: workspaceRoot, timeoutMs });
  return {
    toolVersion,
    info: parsePdfInfoOutput(stdout),
  };
}

async function runQpdfJson(inputPath, workspaceRoot, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const toolVersion = await getToolVersion("qpdf", ["--version"], { cwd: workspaceRoot });
  const { stdout } = await runCli("qpdf", ["--json", inputPath], {
    cwd: workspaceRoot,
    acceptedExitCodes: [0, 3],
    timeoutMs,
  });
  return {
    toolVersion,
    json: JSON.parse(stdout),
  };
}

function findAnnotatedPages(qpdfJson, objectMap) {
  const annotatedPages = [];
  for (const page of qpdfJson?.pages ?? []) {
    const pageObject = getObjectValue(objectMap, page.object);
    if (Array.isArray(pageObject?.["/Annots"]) && pageObject["/Annots"].length > 0) {
      annotatedPages.push(page.pageposfrom1);
    }
  }
  return annotatedPages;
}

function extractSignatureRecords(qpdfJson, objectMap) {
  const fields = qpdfJson?.acroform?.fields ?? [];
  const records = [];
  for (const field of fields) {
    const normalizedField = normalizeQpdfValue(field);
    const signatureRef = normalizedField.value;
    const signatureValue = getObjectValue(objectMap, signatureRef);
    if (normalizedField.fieldtype !== "/Sig" && signatureValue?.["/Type"] !== "/Sig") {
      continue;
    }
    records.push({
      field_name: normalizedField.fullname ?? normalizedField.partialname ?? normalizedField.alternativename ?? null,
      page_no: normalizedField.pageposfrom1 ?? null,
      field_object_ref: normalizedField.object ?? null,
      signature_object_ref: signatureRef ?? null,
      populated: Boolean(signatureRef),
      byte_range: Array.isArray(signatureValue?.["/ByteRange"]) ? signatureValue["/ByteRange"] : null,
      signing_time_raw: parsePdfDate(signatureValue?.["/M"] ?? null),
      signer_name: signatureValue?.["/Name"] ?? null,
      reason: signatureValue?.["/Reason"] ?? null,
      location: signatureValue?.["/Location"] ?? null,
      contact_info: signatureValue?.["/ContactInfo"] ?? null,
      filter: signatureValue?.["/Filter"] ?? null,
      sub_filter: signatureValue?.["/SubFilter"] ?? null,
      certificate_metadata_status: "unknown",
    });
  }
  return records;
}

export function buildInventoryPayload({ pdfInfo, qpdfJson, literalText }) {
  const objectMap = buildQpdfObjectMap(qpdfJson);
  const signatureRecords = extractSignatureRecords(qpdfJson, objectMap);
  const annotatedPages = findAnnotatedPages(qpdfJson, objectMap);
  const pagesWithImages = (qpdfJson?.pages ?? []).filter((page) => (page.images ?? []).length > 0).map((page) => page.pageposfrom1);
  const attachments = qpdfJson?.attachments ?? {};
  const trailer = normalizeQpdfValue(objectMap.trailer?.value ?? null);
  return {
    artifact_kind: "pdf-structure-inventory",
    pdf_metadata: {
      page_count: Number(pdfInfo.pages ?? qpdfJson?.pages?.length ?? 0),
      pdf_version: pdfInfo.pdf_version ?? null,
      encrypted: parseBooleanField(pdfInfo.encrypted),
      form: pdfInfo.form ?? null,
      tagged: parseBooleanField(pdfInfo.tagged),
      creator: pdfInfo.creator ?? null,
      producer: pdfInfo.producer ?? null,
      title: pdfInfo.title ?? null,
      author: pdfInfo.author ?? null,
      subject: pdfInfo.subject ?? null,
      creation_date: pdfInfo.creationdate ?? null,
      modification_date: pdfInfo.moddate ?? null,
    },
    channels: {
      native_text: literalText.length > 0
        ? triState("present", { literal_text_length: literalText.length })
        : triState("absent", { literal_text_length: 0 }),
      page_raster_content: pagesWithImages.length > 0
        ? triState("present", { pages_with_images: pagesWithImages })
        : triState("absent", { pages_with_images: [] }),
      annotations: annotatedPages.length > 0
        ? triState("present", { annotated_pages: annotatedPages })
        : triState("absent", { annotated_pages: [] }),
      widgets_or_acroform: qpdfJson?.acroform?.hasacroform
        ? triState("present", { field_count: (qpdfJson?.acroform?.fields ?? []).length })
        : triState("absent", { field_count: 0 }),
      signature_fields_or_dictionaries: signatureRecords.length > 0
        ? triState("present", { signature_field_count: signatureRecords.length })
        : triState("absent", { signature_field_count: 0 }),
      embedded_file_indicators: Object.keys(attachments).length > 0
        ? triState("present", { attachment_names: Object.keys(attachments) })
        : triState("absent", { attachment_names: [] }),
    },
    structural_diagnostics: {
      has_trailer_prev: Object.prototype.hasOwnProperty.call(trailer ?? {}, "/Prev"),
      max_object_id: qpdfJson?.qpdf?.[0]?.maxobjectid ?? null,
      acroform_need_appearances: qpdfJson?.acroform?.needappearances ?? null,
    },
  };
}

export async function extractPdfLiteralTextArtifact({
  workspaceRoot,
  inputPath,
  artifactDir,
  binaryRow,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const { toolVersion, text, args } = await runPdftotext(inputPath, workspaceRoot, { timeoutMs });
  await writeText(path.join(artifactDir, "text.txt"), text);
  await writeJson(path.join(artifactDir, "native.json"), {
    artifact_kind: "pdf-literal-text",
    channel: "native_literal_pdf_text",
    source_binary: {
      sha256: binaryRow.sha256,
      file_binary_id: binaryRow.id,
    },
    extractor: {
      tool: "pdftotext",
      tool_version: toolVersion,
      args,
    },
    text_length: text.length,
    empty_result: text.length === 0,
  });
  return {
    toolVersion,
    text,
  };
}

export async function extractPdfStructureInventoryArtifact({
  workspaceRoot,
  inputPath,
  artifactDir,
  binaryRow,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const [{ toolVersion: pdfinfoVersion, info }, { toolVersion: qpdfVersion, json }, { text: literalText, toolVersion: pdftotextVersion }] = await Promise.all([
    runPdfinfo(inputPath, workspaceRoot, { timeoutMs }),
    runQpdfJson(inputPath, workspaceRoot, { timeoutMs }),
    runPdftotext(inputPath, workspaceRoot, { timeoutMs }),
  ]);
  const payload = buildInventoryPayload({
    pdfInfo: info,
    qpdfJson: json,
    literalText,
  });
  payload.source_binary = {
    sha256: binaryRow.sha256,
    file_binary_id: binaryRow.id,
  };
  payload.extractors = [
    { tool: "pdfinfo", tool_version: pdfinfoVersion },
    { tool: "qpdf", tool_version: qpdfVersion, args: ["--json", "<input>"] },
    { tool: "pdftotext", tool_version: pdftotextVersion, args: ["-layout", "-enc", "UTF-8", "<input>", "-"] },
  ];
  await writeJson(path.join(artifactDir, "native.json"), payload);
  return payload;
}

export async function extractPdfSignatureMetadataArtifact({
  workspaceRoot,
  inputPath,
  artifactDir,
  binaryRow,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const { toolVersion, json } = await runQpdfJson(inputPath, workspaceRoot, { timeoutMs });
  const objectMap = buildQpdfObjectMap(json);
  const signatures = extractSignatureRecords(json, objectMap);
  const payload = {
    artifact_kind: "pdf-signature-metadata",
    source_binary: {
      sha256: binaryRow.sha256,
      file_binary_id: binaryRow.id,
    },
    extractor: {
      tool: "qpdf",
      tool_version: toolVersion,
      args: ["--json", "<input>"],
    },
    signature_fields_status: signatures.length > 0 ? "present" : "absent",
    signature_dictionary_status: signatures.some((item) => item.signature_object_ref) ? "present" : "absent",
    certificate_metadata_status: "unknown",
    signatures,
  };
  await writeJson(path.join(artifactDir, "native.json"), payload);
  return payload;
}

export async function readArtifactJson(artifactDir, fileName = "native.json") {
  return readJson(path.join(artifactDir, fileName));
}

export {
  extractSignatureRecords,
};
