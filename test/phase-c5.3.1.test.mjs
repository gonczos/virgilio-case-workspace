import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REPRESENTATION_KIND,
  DOCLING_PROCESSOR_VERSION,
  PDF_LITERAL_TEXT_REPRESENTATION_KIND,
  determineProcessingPolicy,
} from "../app/processing-registry.mjs";
import {
  buildInventoryPayload,
  extractSignatureRecords,
} from "../app/pdf-evidence.mjs";
import {
  assertProcessingSchema,
  withClient,
} from "../app/processing-common.mjs";
import {
  resolveEffectiveRepresentation,
} from "../app/processing-store.mjs";

function dbTest(name, fn) {
  test(name, { concurrency: false }, fn);
}

async function withRollbackDb(fn) {
  return withClient("phase-c5.3.1-test", async (client) => {
    await assertProcessingSchema(client);
    await client.query("BEGIN");
    try {
      const fixtureBinary = (await client.query(
        `
          SELECT id
          FROM casework.file_binary
          ORDER BY id ASC
          LIMIT 1
        `,
      )).rows[0];
      const result = await fn(client, fixtureBinary);
      await client.query("ROLLBACK");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function insertJob(client, {
  fileBinaryId,
  processorKey,
  processorVersion,
  status = "completed",
}) {
  return (await client.query(
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
      VALUES ('EXTRACT_STRUCTURE', $1, $2, $3, $4, 'phase-c5.3.1-test', NOW(), NOW(), NOW(), 1, 1)
      RETURNING *
    `,
    [status, fileBinaryId, processorKey, processorVersion],
  )).rows[0];
}

async function insertRepresentation(client, {
  fileBinaryId,
  producedByJobId,
  processorKey,
  processorVersion,
  representationKind = DEFAULT_REPRESENTATION_KIND,
}) {
  return (await client.query(
    `
      INSERT INTO casework.document_representation (
        file_binary_id,
        produced_by_job_id,
        representation_kind,
        format_family,
        processor_key,
        processor_version,
        representation_source_kind,
        representation_variant_key,
        metadata_json,
        content_json,
        artifact_rel_path
      )
      VALUES ($1, $2, $3, 'pdf', $4, $5, 'machine_generated', '', '{}'::jsonb, '{}'::jsonb, NULL)
      RETURNING *
    `,
    [fileBinaryId, producedByJobId, representationKind, processorKey, processorVersion],
  )).rows[0];
}

test("determineProcessingPolicy adds PDF evidence processors and limits OCR to image-heavy readability classes", async () => {
  const textPdf = determineProcessingPolicy({
    mime_type: "application/pdf",
    file_extension: ".pdf",
    machine_readability_status: "text_pdf",
  }).map((item) => item.key);
  const imageOnlyPdf = determineProcessingPolicy({
    mime_type: "application/pdf",
    file_extension: ".pdf",
    machine_readability_status: "image_only_pdf",
  }).map((item) => item.key);
  const mixedPdf = determineProcessingPolicy({
    mime_type: "application/pdf",
    file_extension: ".pdf",
    machine_readability_status: "mixed_pdf",
  }).map((item) => item.key);

  assert.deepEqual(textPdf, [
    "pdf_literal_text",
    "pdf_signature_metadata",
    "pdf_structure_inventory",
    "docling",
    "xberg",
  ]);
  assert.deepEqual(imageOnlyPdf, [
    "pdf_literal_text",
    "pdf_signature_metadata",
    "pdf_structure_inventory",
    "docling",
    "xberg",
    "pdf_ocr_text",
  ]);
  assert.deepEqual(mixedPdf, [
    "pdf_literal_text",
    "pdf_signature_metadata",
    "pdf_structure_inventory",
    "docling",
    "xberg",
  ]);
});

test("qpdf-shaped signature extraction preserves structural facts without implying validation", async () => {
  const qpdfJson = {
    acroform: {
      hasacroform: true,
      fields: [
        {
          fieldtype: "/Sig",
          fullname: "Signature1",
          object: "126 0 R",
          pageposfrom1: 1,
          value: "120 0 R",
        },
      ],
    },
  };
  const objectMap = {
    "obj:120 0 R": {
      value: {
        "/Type": "/Sig",
        "/ByteRange": [0, 472580, 504582, 14472],
        "/M": "u:D:20220113144745+00'00'",
        "/Name": "u:Fátima Morgado",
        "/Reason": "u:Ato Processual",
        "/ContactInfo": "u:maria.fe.silva@juizes-csm.org.pt",
        "/SubFilter": "/adbe.pkcs7.sha1",
      },
    },
  };
  const signatures = extractSignatureRecords(qpdfJson, objectMap);
  assert.deepEqual(signatures, [{
    field_name: "Signature1",
    page_no: 1,
    field_object_ref: "126 0 R",
    signature_object_ref: "120 0 R",
    populated: true,
    byte_range: [0, 472580, 504582, 14472],
    signing_time_raw: "20220113144745+00'00'",
    signer_name: "Fátima Morgado",
    reason: "Ato Processual",
    location: null,
    contact_info: "maria.fe.silva@juizes-csm.org.pt",
    filter: null,
    sub_filter: "/adbe.pkcs7.sha1",
    certificate_metadata_status: "unknown",
  }]);
});

test("structure inventory preserves present absent and unknown semantics distinctly", async () => {
  const payload = buildInventoryPayload({
    pdfInfo: {
      pages: "2",
      pdf_version: "1.5",
      form: "AcroForm",
      encrypted: "no",
      tagged: "yes",
    },
    qpdfJson: {
      pages: [
        { object: "5 0 R", pageposfrom1: 1, images: [{ object: "18 0 R" }] },
        { object: "6 0 R", pageposfrom1: 2, images: [] },
      ],
      acroform: {
        hasacroform: true,
        needappearances: false,
        fields: [{
          fieldtype: "/Sig",
          fullname: "Signature1",
          object: "126 0 R",
          pageposfrom1: 1,
          value: "120 0 R",
        }],
      },
      attachments: {},
      qpdf: [
        { maxobjectid: 126 },
        {
          "obj:5 0 R": { value: { "/Annots": ["126 0 R"] } },
          "obj:6 0 R": { value: {} },
          "obj:120 0 R": { value: { "/Type": "/Sig" } },
          trailer: { value: { "/Prev": 469800 } },
        },
      ],
    },
    literalText: "Assinado em 13-01-2022, por",
  });
  assert.equal(payload.channels.native_text.status, "present");
  assert.equal(payload.channels.page_raster_content.status, "present");
  assert.equal(payload.channels.annotations.status, "present");
  assert.equal(payload.channels.widgets_or_acroform.status, "present");
  assert.equal(payload.channels.signature_fields_or_dictionaries.status, "present");
  assert.equal(payload.channels.embedded_file_indicators.status, "absent");
  assert.equal(payload.structural_diagnostics.has_trailer_prev, true);
});

dbTest("effective consultation selection ignores non-default evidence representation kinds", async () => {
  await withRollbackDb(async (client, binary) => {
    const doclingJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "docling",
      processorVersion: DOCLING_PROCESSOR_VERSION,
    });
    const doclingRepresentation = await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: doclingJob.id,
      processorKey: "docling",
      processorVersion: DOCLING_PROCESSOR_VERSION,
    });
    const evidenceJob = await insertJob(client, {
      fileBinaryId: binary.id,
      processorKey: "pdf_literal_text",
      processorVersion: "poppler-layout-v1-c5.3.1",
    });
    await insertRepresentation(client, {
      fileBinaryId: binary.id,
      producedByJobId: evidenceJob.id,
      processorKey: "pdf_literal_text",
      processorVersion: "poppler-layout-v1-c5.3.1",
      representationKind: PDF_LITERAL_TEXT_REPRESENTATION_KIND,
    });

    const resolved = await resolveEffectiveRepresentation(client, { fileBinaryId: binary.id });
    assert.equal(resolved.representation.id, doclingRepresentation.id);
    assert.equal(resolved.representation.representation_kind, DEFAULT_REPRESENTATION_KIND);
  });
});
