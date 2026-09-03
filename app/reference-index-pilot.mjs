import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { getWorkspaceRoot, withClient } from "./processing-common.mjs";
import {
  REFERENCE_EXTRACTOR_KEY,
  REFERENCE_EXTRACTOR_VERSION,
  extractLabelledReferences,
  lookupReference,
  searchPassages,
  upsertReferenceObservation,
} from "./reference-search-store.mjs";

const FIXTURE_PATH = path.join(getWorkspaceRoot(), "test", "fixtures", "reference-index-pilot.json");

async function loadFixture() {
  return JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
}

async function resolveAvailableSelection(client, item) {
  const result = await client.query(`
    SELECT bd.id AS bucket_document_id, d.id AS document_id,
           fb.id AS file_binary_id, fb.sha256, b.reference_number,
           d.document_procinfo
    FROM casework.bucket_document bd
    JOIN casework.bucket b ON b.id = bd.bucket_id
    JOIN casework.case_file cf ON cf.id = b.case_file_id
    JOIN casework.document d ON d.id = bd.document_id
    JOIN casework.document_binary db ON db.document_id = d.id
    JOIN casework.file_binary fb ON fb.id = db.file_binary_id
    WHERE cf.processo = $1 AND b.reference_number = $2 AND fb.sha256 = $3
  `, [item.process, item.bucket_reference, item.sha256]);
  if (result.rowCount !== 1) {
    throw new Error(`Fixture selection did not resolve uniquely: ${item.process}/${item.bucket_reference}/${item.sha256}`);
  }
  return result.rows[0];
}

async function resolveMissingSelection(client, item) {
  const result = await client.query(`
    SELECT bd.id AS bucket_document_id, d.id AS document_id,
           b.reference_number, d.document_procinfo
    FROM casework.bucket_document bd
    JOIN casework.bucket b ON b.id = bd.bucket_id
    JOIN casework.case_file cf ON cf.id = b.case_file_id
    JOIN casework.document d ON d.id = bd.document_id
    WHERE cf.processo = $1 AND b.reference_number = $2
      AND d.document_procinfo = $3
      AND NOT EXISTS (SELECT 1 FROM casework.document_binary db WHERE db.document_id = d.id)
  `, [item.process, item.bucket_reference, item.source_document_reference]);
  if (result.rowCount !== 1) {
    throw new Error(`Missing-binary fixture selection did not resolve uniquely: ${item.source_document_reference}`);
  }
  return result.rows[0];
}

async function addSourceIdentityObservations(client, row, fixtureMetadata) {
  const common = {
    observed_in_kind: "source_record",
    bucket_document_id: row.bucket_document_id,
    document_id: row.document_id,
    file_binary_id: row.file_binary_id ?? null,
    observer_key: "virgilio-imported-source-record",
    observer_version: "v1",
    confidence: "high",
    review_state: "unreviewed",
    metadata: fixtureMetadata,
  };
  await upsertReferenceObservation(client, {
    ...common,
    raw_value: row.reference_number,
    raw_label: "bucket.reference_number",
    namespace_hint: "citius_occurrence_reference",
    role_hint: "source_recorded_occurrence_identifier",
    target_candidates: [{ kind: "occurrence", bucket_document_id: row.bucket_document_id }],
  });
  await upsertReferenceObservation(client, {
    ...common,
    raw_value: row.document_procinfo,
    raw_label: "document.document_procinfo",
    namespace_hint: "source_document_key",
    role_hint: "source_recorded_document_identifier",
    target_candidates: [{ kind: "source_document", document_id: row.document_id }],
  });
}

async function addLiteralTextObservations(client, row, fixtureMetadata) {
  const segments = await client.query(`
    SELECT ds.id AS document_segment_id, ds.text_content, ds.page_no,
           dr.id AS document_representation_id
    FROM casework.document_representation dr
    JOIN casework.document_segment ds ON ds.document_representation_id = dr.id
    WHERE dr.file_binary_id = $1
      AND dr.processor_key = 'pdf_literal_text'
      AND NULLIF(BTRIM(ds.text_content), '') IS NOT NULL
    ORDER BY dr.created_at DESC, dr.id DESC, ds.sequence_no
  `, [row.file_binary_id]);
  for (const segment of segments.rows) {
    for (const found of extractLabelledReferences(segment.text_content)) {
      await upsertReferenceObservation(client, {
        ...found,
        observed_in_kind: "segment",
        file_binary_id: row.file_binary_id,
        document_representation_id: segment.document_representation_id,
        document_segment_id: segment.document_segment_id,
        page_no: segment.page_no,
        observer_key: REFERENCE_EXTRACTOR_KEY,
        observer_version: REFERENCE_EXTRACTOR_VERSION,
        namespace_hint: null,
        target_candidates: [],
        confidence: "high",
        review_state: "unreviewed",
        metadata: {
          fixture_name: fixtureMetadata.fixture_name,
          fixture_version: fixtureMetadata.fixture_version,
          location_limitation: segment.page_no ? null : "document_level_only",
        },
      });
    }
  }
}

export async function seedReferencePilot(client) {
  const fixture = await loadFixture();
  const distinctBinaries = new Set(fixture.selection.map((item) => item.sha256));
  if (distinctBinaries.size > fixture.maximum_distinct_binaries) {
    throw new Error(`Fixture exceeds hard ceiling: ${distinctBinaries.size} > ${fixture.maximum_distinct_binaries}`);
  }
  const resolved = [];
  await client.query("BEGIN");
  try {
    await client.query(`
      DELETE FROM casework.reference_observation
      WHERE observer_key = $1
        AND observer_version <> $2
        AND metadata_json->>'fixture_name' = $3
    `, [REFERENCE_EXTRACTOR_KEY, REFERENCE_EXTRACTOR_VERSION, fixture.fixture_name]);
    for (const item of fixture.selection) {
      const row = await resolveAvailableSelection(client, item);
      const metadata = { fixture_name: fixture.fixture_name, fixture_version: fixture.fixture_version, reason: item.reason };
      await addSourceIdentityObservations(client, row, metadata);
      await addLiteralTextObservations(client, row, metadata);
      resolved.push({ ...row, process: item.process });
    }
    for (const item of fixture.missing_binary_selection) {
      const row = await resolveMissingSelection(client, item);
      await addSourceIdentityObservations(client, row, {
        fixture_name: fixture.fixture_name, fixture_version: fixture.fixture_version, reason: item.reason,
      });
      resolved.push({ ...row, process: item.process, missing_binary: true });
    }
    for (const assertion of fixture.register_assertions) {
      const match = resolved.find((row) => row.process === assertion.process
        && row.reference_number === assertion.bucket_reference && row.file_binary_id);
      if (!match) throw new Error(`Register assertion has no fixture context: ${assertion.process}/${assertion.bucket_reference}`);
      await upsertReferenceObservation(client, {
        raw_value: assertion.raw_value,
        raw_label: assertion.raw_label,
        observed_in_kind: "metadata_row",
        bucket_document_id: match.bucket_document_id,
        document_id: match.document_id,
        file_binary_id: match.file_binary_id,
        observer_key: "document-register-csv",
        observer_version: "2026-09-03-supplied-snapshot",
        namespace_hint: null,
        role_hint: "register_assertion_unresolved",
        target_candidates: [],
        confidence: null,
        review_state: assertion.review_state,
        metadata: { fixture_name: fixture.fixture_name, source_column: assertion.raw_label },
      });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  const count = await client.query(`
    SELECT COUNT(*)::int AS observations
    FROM casework.reference_observation
    WHERE metadata_json->>'fixture_name' = $1
  `, [fixture.fixture_name]);
  return { fixture: fixture.fixture_name, distinct_binaries: distinctBinaries.size, contexts: resolved.length, observations: count.rows[0].observations };
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const command = process.argv[2] ?? "seed";
  await withClient("reference-index-pilot", async (client) => {
    if (command === "seed") console.log(JSON.stringify(await seedReferencePilot(client), null, 2));
    else if (command === "lookup") console.log(JSON.stringify(await lookupReference(client, optionValue("--value")), null, 2));
    else if (command === "search") {
      const fixture = await loadFixture();
      const sha256s = [...new Set(fixture.selection.map((item) => item.sha256))];
      console.log(JSON.stringify(await searchPassages(client, optionValue("--query"), {
        limit: optionValue("--limit"), sha256s,
      }), null, 2));
    }
    else throw new Error(`Unknown command: ${command}`);
  });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
