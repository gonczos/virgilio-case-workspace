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
  normalizeReferenceValue,
  searchPassages,
  upsertReferenceObservation,
} from "./reference-search-store.mjs";

const FIXTURE_PATH = path.join(getWorkspaceRoot(), "test", "fixtures", "reference-index-pilot.json");

export async function loadReferencePilotFixture() {
  return JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
}

function observationLocation(observation) {
  if (observation.observed_in_kind === "source_record") {
    return { kind: "source_record", pdf_page: null };
  }
  if (observation.observed_in_kind === "metadata_row") {
    return { kind: "metadata_record", pdf_page: null };
  }
  const hasDocumentContentAnchor = (
    observation.document_segment_id !== null
      && observation.document_segment_id !== undefined
  ) || (
    observation.document_representation_id !== null
      && observation.document_representation_id !== undefined
  );
  if (!hasDocumentContentAnchor && observation.file_binary_id !== null
    && observation.file_binary_id !== undefined) {
    return { kind: "binary_level", pdf_page: null };
  }
  if (observation.page_no === null || observation.page_no === undefined) {
    return { kind: "document_level", pdf_page: null };
  }
  const metadata = observation.metadata ?? observation.metadata_json ?? {};
  return {
    kind: metadata.pdf_page_verified === true
      ? "verified_pdf_page"
      : "processor_page_unverified",
    pdf_page: Number(observation.page_no),
  };
}

function extractorObservationState(observation) {
  if (observation.observer_key !== REFERENCE_EXTRACTOR_KEY) return "not_extractor_observation";
  if (observation.observer_version === REFERENCE_EXTRACTOR_VERSION) return "current";
  return observation.review ? "retained_older_reviewed" : "older";
}

export function buildReferencePilotObservation(observation) {
  const reviewedCandidates = observation.review?.target_candidates ?? [];
  const resolutionState = observation.review?.resolution_state ?? "unresolved";
  return {
    binary_identity: observation.sha256 ? {
      file_binary_id: observation.file_binary_id,
      sha256: observation.sha256,
      detail_api_path: `/api/consultation/binaries/${observation.sha256}`,
    } : null,
    source_document_identity: observation.document_id ? {
      document_id: observation.document_id,
      source_document_reference: observation.document_procinfo ?? null,
    } : null,
    source_contexts: observation.source_contexts ?? [],
    observation: {
      id: observation.id,
      observation_key: observation.observation_key,
      raw_value: observation.raw_value,
      normalized_value: observation.normalized_value ?? null,
      raw_label: observation.raw_label,
      observed_in_kind: observation.observed_in_kind,
      namespace_hint: observation.namespace_hint,
      role_hint: observation.role_hint,
      target_candidates: observation.target_candidates ?? observation.target_candidates_json ?? [],
      provenance: {
        bucket_document_id: observation.bucket_document_id,
        document_id: observation.document_id,
        file_binary_id: observation.file_binary_id,
        document_representation_id: observation.document_representation_id,
        document_segment_id: observation.document_segment_id,
        observer_key: observation.observer_key,
        observer_version: observation.observer_version,
        processor_key: observation.source_processor_key ?? null,
        processor_version: observation.source_processor_version ?? null,
        occurrence_reference: observation.source_occurrence_reference
          ?? observation.occurrence_reference ?? null,
        process_number: observation.source_process_number ?? observation.process_number ?? null,
      },
      location: observationLocation(observation),
      char_start: observation.char_start,
      char_end: observation.char_end,
      context_text: observation.context_text,
      confidence: observation.confidence,
      review_state: observation.review_state,
    },
    extractor_observation_state: extractorObservationState(observation),
    target_resolution: {
      state: resolutionState,
      resolved_target: resolutionState === "resolved" ? reviewedCandidates[0] ?? null : null,
      candidates: reviewedCandidates,
      review: observation.review ?? null,
    },
  };
}

function fixtureSummary(fixture) {
  return {
    name: fixture.fixture_name,
    version: fixture.fixture_version,
    distinct_binary_count: new Set(fixture.selection.map((item) => item.sha256)).size,
    missing_binary_record_count: fixture.missing_binary_selection.length,
  };
}

export async function lookupReferencePilot(client, value) {
  const fixture = await loadReferencePilotFixture();
  const rows = await lookupReference(client, value, { fixtureName: fixture.fixture_name });
  return {
    fixture: fixtureSummary(fixture),
    lookup: { exact_normalized_value: normalizeReferenceValue(value) },
    semantics: {
      observations_are_not_resolved_targets: true,
      reviewed_resolution_is_separate: true,
      observation_location_kinds: [
        "source_record", "metadata_record", "binary_level", "document_level",
        "processor_page_unverified", "verified_pdf_page",
      ],
    },
    items: rows.map(buildReferencePilotObservation),
  };
}

export async function searchReferencePilot(client, query, { limit = 20, scope = "pilot" } = {}) {
  const fixture = await loadReferencePilotFixture();
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const sha256s = scope === "full"
    ? null
    : [...new Set(fixture.selection.map((item) => item.sha256))];
  const probedRows = await searchPassages(client, query, {
    limit: boundedLimit + 1,
    maximumLimit: 101,
    sha256s,
  });
  const capped = probedRows.length > boundedLimit;
  const rows = probedRows.slice(0, boundedLimit);
  return {
    fixture: fixtureSummary(fixture),
    query: { text: query, limit: boundedLimit, scope },
    result_summary: {
      passage_limit: boundedLimit,
      returned_passage_count: rows.length,
      distinct_binary_count: new Set(rows.map((row) => row.sha256)).size,
      capped,
    },
    semantics: {
      search_scope: scope,
      passage_references_are_exact_segment_observations: true,
      contextual_references_are_not_observed_in_the_matching_passage: true,
      location_kinds: ["document_level", "processor_page_unverified", "verified_pdf_page"],
    },
    items: rows.map((row) => ({
      ...row,
      location: {
        kind: row.location_kind,
        pdf_page: row.page_no === null ? null : Number(row.page_no),
      },
      passage_reference_observations: row.passage_reference_observations
        .map(buildReferencePilotObservation),
      contextual_reference_observations: row.contextual_reference_observations
        .map(buildReferencePilotObservation),
    })),
  };
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
  const fixture = await loadReferencePilotFixture();
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
        AND NOT EXISTS (
          SELECT 1 FROM casework.reference_observation_review review
          WHERE review.reference_observation_id = reference_observation.id
        )
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
    else if (command === "lookup") console.log(JSON.stringify(await lookupReferencePilot(client, optionValue("--value")), null, 2));
    else if (command === "search") {
      console.log(JSON.stringify(await searchReferencePilot(client, optionValue("--query"), {
        limit: optionValue("--limit"),
      }), null, 2));
    }
    else throw new Error(`Unknown command: ${command}`);
  });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
