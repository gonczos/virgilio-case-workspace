import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertProcessingSchema,
  ensureDir,
  getWorkspaceRoot,
  withClient,
} from "./processing-common.mjs";
import {
  buildComparisonObservation,
} from "./processing-comparison.mjs";
import {
  PDF_LITERAL_TEXT_REPRESENTATION_KIND,
  PDF_OCR_TEXT_REPRESENTATION_KIND,
  PDF_SIGNATURE_METADATA_REPRESENTATION_KIND,
  PDF_STRUCTURE_INVENTORY_REPRESENTATION_KIND,
} from "./processing-registry.mjs";
import {
  enqueueJobsForBinary,
  getRepresentationText,
  listRepresentationsForBinary,
  runWorkerLoop,
} from "./processing-store.mjs";
import {
  hasRepresentationArtifactFormat,
  readRepresentationArtifact,
} from "./representation-artifacts.mjs";

const REQUESTED_BY = "phase-c5.3.2-rollout";
const OUTPUT_REL_PATH = path.join("data", "exports", "phase-c5.3.2", "rollout-summary.json");
const MAIN_FILE_PATH = fileURLToPath(import.meta.url);

const SAMPLE = [
  { sha256: "6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c", note: "signed regression case" },
  { sha256: "17eb40fa6ca2c37156d9c230640ff03efbddfa531111f09bb03a7152f9e4a691", note: "clean text high-disagreement case" },
  { sha256: "24c8c65472964ea3dcb0b279e0a3cc1df3a56b78382abb345d863e3630a8b368", note: "appeal annex header/footer case" },
  { sha256: "ce0574353b545ed3a84c40194fd7571ea40b2339963061c407febc0522bf1800", note: "mixed PDF disagreement case" },
  { sha256: "adcde0cb1e946487996d48762e70501bec852e2803c918aded1cb2ff3ace51c4", note: "form-like mixed PDF" },
  { sha256: "beaae8cef569cfddd3d14512aa4937561b0255df833973c312cec182755e594d", note: "mostly-image OCR case" },
  { sha256: "02c8e7cee7eca2f83b98d64aa2dd64b1b888039210a8cbf5c2133322d1b1757e", note: "image-only OCR case" },
  { sha256: "72b005fb854888b62f917b7a54838c49e2e9b51e861ccc3d48e9eb010c96e8c9", note: "long mixed/scanned PDF" },
  { sha256: "0d229a578276bd96221ee77e49560317ff88cfebf589322a5c41b974e2eb0e0e", note: "mixed PDF with annotations token" },
  { sha256: "5f3ff23ac83931b4b7e9bf56dc2bf55f2abae43e9167f91da02761e611f29cb1", note: "mostly-image long PDF" },
  { sha256: "9d335b7bb946796c51c965d2cf39d8d6a0279e4d8a4bad558d13174e99d1fe79", note: "image-only long PDF" },
  { sha256: "a7664cc72071b62f62dda2dd1da2ff63e2af65387f1b3d6380f805708ebae901", note: "image-only VersaLink PDF" },
  { sha256: "013097e88b144ec1ed45ad7fe84fe3306a51202110be09434b6dd76064f685ab", note: "recent signed 1-page PDF" },
  { sha256: "02f720c5d46c20a4dd3fccb01705991f445130c378430faeffb145d1e0ef8476", note: "signed 1-page appeal PDF" },
  { sha256: "0e6616257e0724df1c002e07fdce179d04dbf00b4378ce2e7dca6458b0ffeeff", note: "two-signature candidate" },
  { sha256: "f5f9bb877c55df0189a530e567b5c5c3a87af01fc846b14f5f05cc9492729c10", note: "many-signature markers candidate" },
  { sha256: "a74153f1d929db1a678436472a90000d0095c8d9d8677192aa8397e6dd5622bc", note: "long AcroForm multi-signature candidate" },
  { sha256: "d53fe053bc35336d1f81787a2183b7745541d895251e288218e407ef7f37576f", note: "appeal judgment signed PDF" },
  { sha256: "01b17cd701c9270b9bc7a077d79779d3745d6042c231b61bdb97e29cb69b6c07", note: "embedded-file token candidate" },
  { sha256: "90f61798d13e6624b8c5cc89b55cfd6fb7212751ad079bbf26511fbb0efebc53", note: "embedded-file token candidate" },
  { sha256: "00445e909e62504134764a6c333277a3b90d1346a9da17f7c0de2529dbbe277e", note: "clean 1-page text PDF" },
  { sha256: "00b7b153fbf5f9b1e9b0a0d7f99f383ce744bb2b1e81def0fa753454fce830d9", note: "old simple text PDF" },
  { sha256: "ec91590ebe1ef6207116043f60bb150f33e24d1804e0cecd9f24b29226b9ae0d", note: "short mostly-image PDF" },
  { sha256: "414999a9d1ea47289bcddb9dabc8936fbc2596d9dc3c9f80ce1616176dd7d94d", note: "short mixed PDF" },
];

const LITERAL_MATERIAL_EVIDENCE_BY_SHA = new Map([
  [
    "6836f8732aae33a3bc79491748134bd2a77a7b48aeaa2cd7c66647ff1f468f1c",
    "visible signature appearance text absent from interpretation outputs",
  ],
  [
    "d53fe053bc35336d1f81787a2183b7745541d895251e288218e407ef7f37576f",
    "visible signature appearance text absent from interpretation outputs",
  ],
  [
    "f5f9bb877c55df0189a530e567b5c5c3a87af01fc846b14f5f05cc9492729c10",
    "visible signature appearance text absent from interpretation outputs",
  ],
]);

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

function buildValuesClause(rows) {
  return rows.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(", ");
}

function buildValuesParams(rows) {
  return rows.flatMap((row) => [row.sha256, row.note]);
}

async function loadSampleRows(client) {
  const valuesClause = buildValuesClause(SAMPLE);
  const params = buildValuesParams(SAMPLE);
  const result = await client.query(
    `
      WITH sample(sha256, sample_note) AS (
        VALUES ${valuesClause}
      )
      SELECT
        sample.sha256,
        sample.sample_note,
        fb.id AS file_binary_id,
        fb.machine_readability_status,
        fb.page_count,
        fb.actual_size_bytes,
        doc.document_name,
        doc.document_date,
        doc.bucket_id
      FROM sample
      JOIN casework.file_binary AS fb
        ON fb.sha256 = sample.sha256
      LEFT JOIN LATERAL (
        SELECT
          d.document_name,
          d.document_date,
          b.bucket_id
        FROM casework.document_binary AS db
        JOIN casework.document AS d
          ON d.id = db.document_id
        LEFT JOIN casework.bucket_document AS bd
          ON bd.document_id = d.id
        LEFT JOIN casework.bucket AS b
          ON b.id = bd.bucket_id
        WHERE db.file_binary_id = fb.id
        ORDER BY d.document_date NULLS LAST, d.id ASC, bd.bucket_id ASC
        LIMIT 1
      ) AS doc
        ON TRUE
      ORDER BY fb.id ASC
    `,
    params,
  );
  if (result.rowCount !== SAMPLE.length) {
    throw new Error(`Expected ${SAMPLE.length} sample rows but found ${result.rowCount}`);
  }
  return result.rows;
}

async function assertResumeSafeActiveJobs(client) {
  const result = await client.query(
    `
      SELECT id, processor_key, requested_by
      FROM casework.processing_job
      WHERE status IN ('queued', 'running')
      ORDER BY id ASC
      LIMIT 10
    `,
  );
  const foreignJobs = result.rows.filter((row) => row.requested_by !== REQUESTED_BY);
  if (foreignJobs.length > 0) {
    throw new Error(`Refusing rollout with existing active non-rollout jobs: ${JSON.stringify(foreignJobs)}`);
  }
}

async function loadJobSummary(client, sampleRows) {
  const ids = sampleRows.map((row) => row.file_binary_id);
  const result = await client.query(
    `
      SELECT
        id,
        file_binary_id,
        processor_key,
        processor_version,
        status,
        error_code,
        error_text,
        requested_by,
        requested_at,
        started_at,
        completed_at
      FROM casework.processing_job
      WHERE file_binary_id = ANY($1::bigint[])
      ORDER BY file_binary_id ASC, processor_key ASC, processor_version ASC, requested_at ASC, id ASC
    `,
    [ids],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    const list = grouped.get(row.file_binary_id) ?? [];
    list.push(row);
    grouped.set(row.file_binary_id, list);
  }
  return grouped;
}

async function readBestInterpretationText(workspaceRoot, client, representation) {
  if (!representation) {
    return { source: null, text: "" };
  }
  if (await hasRepresentationArtifactFormat(workspaceRoot, representation, "complete-text")) {
    const artifact = await readRepresentationArtifact(workspaceRoot, representation, "complete-text");
    return { source: "complete-text", text: artifact.body };
  }
  return { source: "segment-text", text: await getRepresentationText(client, representation.id) };
}

function findRepresentation(rows, { representationKind, processorKey = null }) {
  return rows.find((row) => row.representation_kind === representationKind && (processorKey === null || row.processor_key === processorKey)) ?? null;
}

function summarizeStructureChannels(nativeArtifact) {
  return {
    native_text: nativeArtifact?.channels?.native_text?.status ?? null,
    page_raster_content: nativeArtifact?.channels?.page_raster_content?.status ?? null,
    annotations: nativeArtifact?.channels?.annotations?.status ?? null,
    widgets_or_acroform: nativeArtifact?.channels?.widgets_or_acroform?.status ?? null,
    signature_fields_or_dictionaries: nativeArtifact?.channels?.signature_fields_or_dictionaries?.status ?? null,
    embedded_file_indicators: nativeArtifact?.channels?.embedded_file_indicators?.status ?? null,
  };
}

function summarizeProcessorJobs(jobs, processorKey) {
  const relevantJobs = jobs.filter((job) => job.processor_key === processorKey);
  const completedJobs = relevantJobs.filter((job) => job.status === "completed");
  const failedJobs = relevantJobs.filter((job) => job.status === "failed");
  const activeJobs = relevantJobs.filter((job) => job.status === "queued" || job.status === "running");
  const timeoutFailures = failedJobs.filter((job) => String(job.error_text ?? "").includes("timed out after"));
  return {
    requested: relevantJobs.length > 0,
    completed: completedJobs.length > 0,
    failed: failedJobs.length > 0,
    active: activeJobs.length > 0,
    completed_job_ids: completedJobs.map((job) => Number(job.id)),
    failed_job_ids: failedJobs.map((job) => Number(job.id)),
    failure_error_codes: [...new Set(failedJobs.map((job) => job.error_code).filter(Boolean))],
    timeout_failures: timeoutFailures.map((job) => ({
      job_id: Number(job.id),
      error_code: job.error_code,
      error_text: job.error_text,
    })),
    recovered_after_failure: completedJobs.length > 0 && failedJobs.length > 0,
  };
}

function buildProcessorStatusMap(jobs) {
  return {
    pdf_literal_text: summarizeProcessorJobs(jobs, "pdf_literal_text"),
    pdf_signature_metadata: summarizeProcessorJobs(jobs, "pdf_signature_metadata"),
    pdf_structure_inventory: summarizeProcessorJobs(jobs, "pdf_structure_inventory"),
    pdf_ocr_text: summarizeProcessorJobs(jobs, "pdf_ocr_text"),
    docling: summarizeProcessorJobs(jobs, "docling"),
    xberg: summarizeProcessorJobs(jobs, "xberg"),
  };
}

function choosePrimaryClassification({
  row,
  evidence,
  interpretation,
  processorStatus,
}) {
  if (!evidence.literal.produced || !evidence.signature.produced || !evidence.structure.produced) {
    return "implementation_defect";
  }

  if (evidence.ocr.applicable && !evidence.ocr.produced) {
    return "policy_gap";
  }

  if (!interpretation.docling.available && processorStatus.docling.timeout_failures.length > 0) {
    return "policy_gap";
  }

  if (!interpretation.xberg.available && processorStatus.xberg.timeout_failures.length > 0) {
    return "policy_gap";
  }

  if ((evidence.signature.signature_count ?? 0) > 1 || evidence.structure.channels.embedded_file_indicators === "present") {
    return "deferred_channel_opportunity";
  }

  return "expected";
}

function buildSecondaryObservations({
  row,
  evidence,
  interpretation,
  processorStatus,
}) {
  const observations = [];
  if (evidence.literal.material_addition.judgment === true) {
    observations.push("literal_text_material_addition");
  }
  if (evidence.ocr.material_addition.judgment === true) {
    observations.push("ocr_material_addition");
  }
  if ((evidence.signature.signature_count ?? 0) > 1) {
    observations.push("multi_signature_candidate");
  }
  if (evidence.structure.channels.embedded_file_indicators === "present") {
    observations.push("embedded_file_indicator_present");
  }
  if (processorStatus.docling.timeout_failures.length > 0) {
    observations.push("docling_timeout_under_current_policy");
  }
  if (processorStatus.pdf_ocr_text.timeout_failures.length > 0) {
    observations.push("ocr_timeout_under_current_policy");
  }
  if (processorStatus.pdf_signature_metadata.recovered_after_failure || processorStatus.pdf_structure_inventory.recovered_after_failure) {
    observations.push("historical_qpdf_warning_failure_recovered");
  }
  if (interpretation.docling.available && interpretation.xberg.available
    && interpretation.docling_vs_xberg?.disagreement_level === "high") {
    observations.push("docling_xberg_high_disagreement");
  }
  if (row.machine_readability_status === "image_only_pdf" && evidence.ocr.produced && !interpretation.docling.available) {
    observations.push("ocr_succeeded_where_docling_interpretation_failed");
  }
  return observations;
}

export function shouldRunWorkerLoopForEnqueueResults(enqueueResults) {
  return enqueueResults.some((row) => row.results.some((result) => result.action === "enqueued" || result.action === "already_active"));
}

async function buildReportRow(workspaceRoot, client, row, jobsByBinaryId) {
  const representations = await listRepresentationsForBinary(client, row.file_binary_id);
  const literal = findRepresentation(representations, { representationKind: PDF_LITERAL_TEXT_REPRESENTATION_KIND, processorKey: "pdf_literal_text" });
  const signature = findRepresentation(representations, { representationKind: PDF_SIGNATURE_METADATA_REPRESENTATION_KIND, processorKey: "pdf_signature_metadata" });
  const structure = findRepresentation(representations, { representationKind: PDF_STRUCTURE_INVENTORY_REPRESENTATION_KIND, processorKey: "pdf_structure_inventory" });
  const ocr = findRepresentation(representations, { representationKind: PDF_OCR_TEXT_REPRESENTATION_KIND, processorKey: "pdf_ocr_text" });
  const docling = findRepresentation(representations, { representationKind: "extracted_document_bundle", processorKey: "docling" });
  const xberg = findRepresentation(representations, { representationKind: "extracted_document_bundle", processorKey: "xberg" });

  const literalText = literal ? await getRepresentationText(client, literal.id) : "";
  const ocrText = ocr ? await getRepresentationText(client, ocr.id) : "";
  const doclingText = await readBestInterpretationText(workspaceRoot, client, docling);
  const xbergText = await readBestInterpretationText(workspaceRoot, client, xberg);
  const signatureArtifact = signature ? (await readRepresentationArtifact(workspaceRoot, signature, "native-json")).body : null;
  const structureArtifact = structure ? (await readRepresentationArtifact(workspaceRoot, structure, "native-json")).body : null;

  const literalVsDocling = literal && docling
    ? buildComparisonObservation({ leftLabel: "pdf_literal_text", rightLabel: "docling", leftText: literalText, rightText: doclingText.text })
    : null;
  const literalVsXberg = literal && xberg
    ? buildComparisonObservation({ leftLabel: "pdf_literal_text", rightLabel: "xberg", leftText: literalText, rightText: xbergText.text })
    : null;
  const ocrVsDocling = ocr && docling
    ? buildComparisonObservation({ leftLabel: "pdf_ocr_text", rightLabel: "docling", leftText: ocrText, rightText: doclingText.text })
    : null;
  const ocrVsXberg = ocr && xberg
    ? buildComparisonObservation({ leftLabel: "pdf_ocr_text", rightLabel: "xberg", leftText: ocrText, rightText: xbergText.text })
    : null;
  const doclingVsXberg = docling && xberg
    ? buildComparisonObservation({ leftLabel: "docling", rightLabel: "xberg", leftText: doclingText.text, rightText: xbergText.text })
    : null;

  const literalMaterialReason = LITERAL_MATERIAL_EVIDENCE_BY_SHA.get(row.sha256) ?? null;
  const ocrMaterialReason = ocrText.length > Math.max(doclingText.text.length, xbergText.text.length) * 1.5
    ? "OCR preserved substantially more page-visible text than current interpretation artifacts"
    : null;
  const jobs = jobsByBinaryId.get(row.file_binary_id) ?? [];
  const processorStatus = buildProcessorStatusMap(jobs);

  const evidence = {
    literal: {
      produced: Boolean(literal),
      representation_id: literal?.id ?? null,
      text_length: literalText.length,
      comparison_facts: {
        vs_docling: literalVsDocling,
        vs_xberg: literalVsXberg,
      },
      material_addition: {
        judgment: literalMaterialReason !== null,
        reason: literalMaterialReason,
      },
    },
    signature: {
      produced: Boolean(signature),
      representation_id: signature?.id ?? null,
      processor_status: processorStatus.pdf_signature_metadata,
      signature_fields_status: signatureArtifact?.signature_fields_status ?? null,
      signature_dictionary_status: signatureArtifact?.signature_dictionary_status ?? null,
      signature_count: signatureArtifact?.signatures?.length ?? null,
      signatures: (signatureArtifact?.signatures ?? []).map((item) => ({
        field_name: item.field_name,
        page_no: item.page_no,
        populated: item.populated,
        byte_range: item.byte_range,
      })),
    },
    structure: {
      produced: Boolean(structure),
      representation_id: structure?.id ?? null,
      processor_status: processorStatus.pdf_structure_inventory,
      channels: structureArtifact ? summarizeStructureChannels(structureArtifact) : {
        native_text: null,
        page_raster_content: null,
        annotations: null,
        widgets_or_acroform: null,
        signature_fields_or_dictionaries: null,
        embedded_file_indicators: null,
      },
    },
    ocr: {
      applicable: row.machine_readability_status === "image_only_pdf" || row.machine_readability_status === "mostly_image_pdf",
      produced: Boolean(ocr),
      representation_id: ocr?.id ?? null,
      processor_status: processorStatus.pdf_ocr_text,
      text_length: ocrText.length,
      comparison_facts: {
        vs_docling: ocrVsDocling,
        vs_xberg: ocrVsXberg,
      },
      material_addition: {
        judgment: ocrMaterialReason !== null,
        reason: ocrMaterialReason,
      },
    },
  };

  const interpretation = {
    docling: {
      available: Boolean(docling),
      representation_id: docling?.id ?? null,
      processor_status: processorStatus.docling,
      text_source: doclingText.source,
      text_length: doclingText.text.length,
    },
    xberg: {
      available: Boolean(xberg),
      representation_id: xberg?.id ?? null,
      processor_status: processorStatus.xberg,
      text_source: xbergText.source,
      text_length: xbergText.text.length,
    },
    docling_vs_xberg: doclingVsXberg,
  };

  const primaryClassification = choosePrimaryClassification({
    row,
    evidence,
    interpretation,
    processorStatus,
  });

  return {
    identity: {
      file_binary_id: row.file_binary_id,
      sha256: row.sha256,
      document_name: row.document_name,
      document_date: row.document_date,
      bucket_id: row.bucket_id,
      machine_readability_status: row.machine_readability_status,
      page_count: row.page_count,
      actual_size_bytes: row.actual_size_bytes,
      sample_note: row.sample_note,
    },
    evidence,
    interpretation,
    jobs,
    primary_classification: primaryClassification,
    secondary_observations: buildSecondaryObservations({
      row,
      evidence,
      interpretation,
      processorStatus,
    }),
  };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const workspaceRoot = getWorkspaceRoot();
  const outputPath = path.resolve(workspaceRoot, String(flags["output-json"] ?? OUTPUT_REL_PATH));
  const startedAt = new Date().toISOString();

    await withClient("phase-c5.3.2-rollout", async (client) => {
      await assertProcessingSchema(client);
      await assertResumeSafeActiveJobs(client);

    const sampleRows = await loadSampleRows(client);
    const enqueueResults = [];
    for (const row of sampleRows) {
      const binaryRow = {
        id: row.file_binary_id,
        sha256: row.sha256,
        machine_readability_status: row.machine_readability_status,
        page_count: row.page_count,
        actual_size_bytes: row.actual_size_bytes,
        mime_type: "application/pdf",
        file_extension: ".pdf",
      };
      const results = await enqueueJobsForBinary(client, binaryRow, {
        requestedBy: REQUESTED_BY,
      });
      enqueueResults.push({
        file_binary_id: row.file_binary_id,
        sha256: row.sha256,
        results,
      });
    }

    const processed = shouldRunWorkerLoopForEnqueueResults(enqueueResults)
      ? await runWorkerLoop(client, {
        once: false,
        pollMs: 500,
      })
      : [];
    const jobsByBinaryId = await loadJobSummary(client, sampleRows);

    const reportRows = [];
    for (const row of sampleRows) {
      reportRows.push(await buildReportRow(workspaceRoot, client, row, jobsByBinaryId));
    }

    const summary = {
      phase: "C5.3.2",
      generated_at: new Date().toISOString(),
      started_at: startedAt,
      requested_by: REQUESTED_BY,
      sample_size: SAMPLE.length,
      enqueue_results: enqueueResults,
      processed_jobs: processed.map((item) => ({
        job_id: item.job.id,
        file_binary_id: item.job.file_binary_id,
        processor_key: item.job.processor_key,
        status: item.status,
        representation_id: item.representation?.id ?? null,
        error: item.error ?? null,
      })),
      result_classification_counts: reportRows.reduce((acc, row) => {
        acc[row.primary_classification] = (acc[row.primary_classification] ?? 0) + 1;
        return acc;
      }, {}),
      rows: reportRows,
    };

    await ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      output_json: path.relative(workspaceRoot, outputPath).replace(/\\/gu, "/"),
      sample_size: summary.sample_size,
      processed_jobs: summary.processed_jobs.length,
      result_classification_counts: summary.result_classification_counts,
    }, null, 2));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === MAIN_FILE_PATH) {
  main().catch((error) => {
    console.error("[phase-c5.3.2-rollout] fatal error");
    console.error(error);
    process.exitCode = 1;
  });
}
