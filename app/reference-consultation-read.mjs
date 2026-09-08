import fs from "node:fs/promises";
import path from "node:path";
import { getWorkspaceRoot } from "./processing-common.mjs";
import {
  REFERENCE_EXTRACTOR_KEY,
  REFERENCE_EXTRACTOR_VERSION,
  lookupReference,
  normalizeReferenceValue,
  searchPassages,
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

export async function searchReferencePilot(client, query, {
  limit = 20,
  offset = 0,
  scope = "pilot",
  sort = "relevance",
} = {}) {
  const fixture = await loadReferencePilotFixture();
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const boundedOffset = Math.max(0, Number(offset) || 0);
  const sha256s = scope === "full"
    ? null
    : [...new Set(fixture.selection.map((item) => item.sha256))];
  const probedRows = await searchPassages(client, query, {
    limit: boundedLimit + 1,
    offset: boundedOffset,
    sort,
    maximumLimit: 101,
    sha256s,
  });
  const probedSha256s = [...new Set(probedRows.map((row) => row.sha256))];
  const returnedSha256s = probedSha256s.slice(0, boundedLimit);
  const returnedSha256Set = new Set(returnedSha256s);
  const capped = probedSha256s.length > boundedLimit;
  const rows = probedRows.filter((row) => returnedSha256Set.has(row.sha256));
  return {
    fixture: fixtureSummary(fixture),
    query: { text: query, limit: boundedLimit, offset: boundedOffset, scope, sort },
    result_summary: {
      requested_offset: boundedOffset,
      pagination_unit: "binary",
      binary_limit: boundedLimit,
      returned_passage_count: rows.length,
      distinct_binary_count: returnedSha256s.length,
      capped,
      has_more: capped,
      next_offset: boundedOffset + returnedSha256s.length,
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
