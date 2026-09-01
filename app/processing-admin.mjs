import fs from "node:fs/promises";
import process from "node:process";

import {
  DEFAULT_SELECTION_PURPOSE,
  QUICK_PREVIEW_PURPOSE,
  assertProcessingSchema,
  withClient,
} from "./processing-common.mjs";
import { exportPortableBinaryPackage } from "./portable-export.mjs";
import {
  clearSelectionOverride,
  countProcessingState,
  createHumanRepresentation,
  enqueueJobsForBinary,
  getBinaryRowBySha,
  inspectJobs,
  inspectRepresentationState,
  recoverRunningJobs,
  upsertSelectionOverride,
} from "./processing-store.mjs";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { command, flags };
}

function requireFlag(flags, key) {
  const value = flags[key];
  if (value === undefined || value === true) {
    throw new Error(`Missing required flag --${key}`);
  }
  return String(value);
}

async function handleEnqueue(client, flags) {
  const sha = requireFlag(flags, "sha");
  const binaryRow = await getBinaryRowBySha(client, sha);
  const processorKeys = flags["processor-key"] === undefined
    ? null
    : String(flags["processor-key"]).split(",").map((item) => item.trim()).filter(Boolean);
  const results = await enqueueJobsForBinary(client, binaryRow, {
    requestedBy: String(flags["requested-by"] ?? "processing-admin"),
    processorKeys,
  });
  console.log(JSON.stringify({ sha256: sha, file_binary_id: binaryRow.id, results }, null, 2));
}

async function handleInspectJobs(client) {
  const jobs = await inspectJobs(client);
  console.log(JSON.stringify(jobs, null, 2));
}

async function handleInspectRepresentation(client, flags) {
  const sha = requireFlag(flags, "sha");
  const binaryRow = await getBinaryRowBySha(client, sha);
  const state = await inspectRepresentationState(client, binaryRow.id);
  console.log(JSON.stringify(state, null, 2));
}

async function handleState(client) {
  const state = await countProcessingState(client);
  console.log(JSON.stringify(state, null, 2));
}

async function handleRecover(client, flags) {
  const olderThanMinutes = Number(flags["older-than-minutes"] ?? 30);
  const recovered = await recoverRunningJobs(client, { olderThanMinutes });
  console.log(JSON.stringify({ recovered_job_ids: recovered }, null, 2));
}

async function handleSelect(client, flags) {
  const sha = requireFlag(flags, "sha");
  const purpose = String(flags.purpose ?? DEFAULT_SELECTION_PURPOSE);
  const representationId = Number(requireFlag(flags, "representation-id"));
  const selectedBy = flags["selected-by"] === undefined ? null : String(flags["selected-by"]);
  const selectionNote = flags["selection-note"] === undefined ? null : String(flags["selection-note"]);
  const binaryRow = await getBinaryRowBySha(client, sha);
  const selection = await upsertSelectionOverride(client, {
    fileBinaryId: binaryRow.id,
    purpose,
    representationId,
    selectedBy,
    selectionNote,
  });
  console.log(JSON.stringify(selection, null, 2));
}

async function handleClearSelection(client, flags) {
  const sha = requireFlag(flags, "sha");
  const purpose = String(flags.purpose ?? DEFAULT_SELECTION_PURPOSE);
  const binaryRow = await getBinaryRowBySha(client, sha);
  await clearSelectionOverride(client, { fileBinaryId: binaryRow.id, purpose });
  console.log(JSON.stringify({ sha256: sha, purpose, cleared: true }, null, 2));
}

async function handleCreateHuman(client, flags) {
  const sha = requireFlag(flags, "sha");
  const binaryRow = await getBinaryRowBySha(client, sha);
  let textContent = flags.text === undefined ? null : String(flags.text);
  if (!textContent && flags["text-file"]) {
    textContent = await fs.readFile(String(flags["text-file"]), "utf8");
  }
  if (!textContent) {
    throw new Error("Provide --text or --text-file for human representation content");
  }
  const representation = await createHumanRepresentation(client, {
    fileBinaryId: binaryRow.id,
    textContent,
    createdBy: flags["created-by"] === undefined ? null : String(flags["created-by"]),
    selectionNote: flags["selection-note"] === undefined ? null : String(flags["selection-note"]),
    basedOnRepresentationId: flags["based-on-representation-id"] === undefined
      ? null
      : Number(flags["based-on-representation-id"]),
  });
  console.log(JSON.stringify(representation, null, 2));
}

async function handleExportBinary(client, flags) {
  const sha = requireFlag(flags, "sha");
  const outputDir = requireFlag(flags, "output");
  const result = await exportPortableBinaryPackage(client, {
    sha256: sha,
    outputDir,
  });
  console.log(JSON.stringify({
    sha256: result.manifest.persisted.file_binary.sha256,
    file_binary_id: result.manifest.persisted.file_binary.id,
    output_dir: result.outputDir,
    package_format: result.manifest.package_format,
    package_version: result.manifest.package_version,
    representation_count: result.manifest.persisted.document_representations.length,
    processing_job_count: result.manifest.persisted.processing_jobs.length,
  }, null, 2));
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command) {
    throw new Error("Usage: node app/processing-admin.mjs <command> [--flags]");
  }
  await withClient("processing-admin", async (client) => {
    await assertProcessingSchema(client);
    switch (command) {
      case "enqueue":
        await handleEnqueue(client, flags);
        break;
      case "inspect-jobs":
        await handleInspectJobs(client);
        break;
      case "inspect-representation":
        await handleInspectRepresentation(client, flags);
        break;
      case "state":
        await handleState(client);
        break;
      case "recover-running":
        await handleRecover(client, flags);
        break;
      case "select-representation":
        await handleSelect(client, flags);
        break;
      case "clear-selection":
        await handleClearSelection(client, flags);
        break;
      case "create-human-representation":
        await handleCreateHuman(client, flags);
        break;
      case "export-binary":
        await handleExportBinary(client, flags);
        break;
      case "list-purposes":
        console.log(JSON.stringify({
          purposes: [DEFAULT_SELECTION_PURPOSE, QUICK_PREVIEW_PURPOSE],
        }, null, 2));
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  });
}

main().catch((error) => {
  console.error("[processing-admin] fatal error");
  console.error(error);
  process.exitCode = 1;
});
