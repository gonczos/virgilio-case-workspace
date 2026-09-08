import { getWorkspaceRoot } from "./processing-common.mjs";
import { getConsultationBinaryDetail, getRepresentationContent, isValidSha256 } from "./consultation-store.mjs";
import { getRepresentationById } from "./processing-store.mjs";
import { searchReferencePilot } from "./reference-consultation-read.mjs";
import { queryCourtRecords } from "./court-records-api.mjs";

const SEARCH_ORDERS = new Set(["relevance", "earliest_occurrence_asc", "latest_occurrence_desc"]);
const SEARCH_SCOPES = new Set(["pilot", "full"]);
const REPRESENTATION_FORMATS = new Set(["text", "markdown", "complete-text", "native-json"]);

export const TEXT_CONSULTATION_MCP_TOOLS = [
  {
    name: "search_document_text",
    description: "Search existing indexed document text. Results preserve binary, representation, processor, location, and procedural context provenance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
        scope: { type: "string", enum: ["full", "pilot"], default: "full" },
        order: { type: "string", enum: [...SEARCH_ORDERS], default: "relevance" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
        offset: { type: "integer", minimum: 0, default: 0 },
      },
    },
  },
  {
    name: "query_court_records",
    description: "Query occurrence-centred court metadata with explicit court, case, bucket, source-document, binary, and recorded-relation identities.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        court_id: { type: "integer", minimum: 1 },
        case_file_id: { type: "integer", minimum: 1 },
        bucket_id: { type: "integer", minimum: 1 },
        bucket_document_id: { type: "integer", minimum: 1 },
        document_id: { type: "integer", minimum: 1 },
        file_binary_id: { type: "integer", minimum: 1 },
        process_number: { type: "string", minLength: 1 },
        occurrence_reference: { type: "string", minLength: 1 },
        source_bucket_id: { type: "string", minLength: 1 },
        source_document_reference: { type: "string", minLength: 1 },
        document_name_contains: { type: "string", minLength: 1 },
        document_type: { type: "string", minLength: 1 },
        date_from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        date_to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        binary_sha256: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
        file_availability: { type: "string", enum: ["available", "missing"] },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        offset: { type: "integer", minimum: 0, maximum: 1000000, default: 0 },
      },
    },
  },
  {
    name: "get_binary_details",
    description: "Get read-only identity, procedural context, available representations, evidence, and processing summary for one SHA-256 binary.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sha256"],
      properties: { sha256: { type: "string", pattern: "^[0-9a-fA-F]{64}$" } },
    },
  },
  {
    name: "get_representation_content",
    description: "Read one existing processor-attributed representation in an available format, with bounded content and exact lineage metadata.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["representation_id", "format"],
      properties: {
        representation_id: { type: "integer", minimum: 1 },
        format: { type: "string", enum: [...REPRESENTATION_FORMATS] },
        offset: { type: "integer", minimum: 0, default: 0 },
        max_characters: { type: "integer", minimum: 1, maximum: 50000, default: 12000 },
      },
    },
  },
];

function toolError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw toolError("INVALID_ARGUMENTS", "arguments must be an object");
  }
}

function rejectUnknown(argumentsObject, permitted) {
  const unknown = Object.keys(argumentsObject).find((key) => !permitted.has(key));
  if (unknown) throw toolError("UNKNOWN_ARGUMENT", `unknown argument: ${unknown}`);
}

function integerArgument(value, fallback, { min, max = Number.MAX_SAFE_INTEGER, name }) {
  const parsed = value === undefined ? fallback : value;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw toolError("INVALID_ARGUMENT", `${name} must be an integer from ${min} through ${max}`);
  }
  return parsed;
}

function compactSearchItem(row) {
  return {
    sha256: row.sha256,
    binary_detail: { sha256: row.sha256, tool: "get_binary_details" },
    representation: {
      representation_id: Number(row.document_representation_id),
      representation_kind: row.representation_kind,
      processor_key: row.processor_key,
      processor_version: row.processor_version,
      content_tool: "get_representation_content",
    },
    segment: {
      segment_id: Number(row.segment_id),
      segment_kind: row.segment_kind,
      sequence_no: Number(row.sequence_no),
      char_start: row.char_start === null ? null : Number(row.char_start),
      char_end: row.char_end === null ? null : Number(row.char_end),
    },
    location: row.location,
    headline: row.headline,
    rank: Number(row.rank),
    binary_relevance_rank: Number(row.binary_relevance_rank),
    occurrence_date_bounds: {
      earliest: row.earliest_occurrence_date ?? null,
      latest: row.latest_occurrence_date ?? null,
      semantics: "recorded procedural occurrence dates; not necessarily document-written or signed dates",
    },
    source_contexts: row.source_contexts,
  };
}

export function compactBinaryDetail(detail) {
  const { original_binary_url: _localOnlyUrl, ...binary } = detail.binary;
  return {
    binary,
    context: detail.context,
    representations: detail.representations,
    evidence: detail.evidence,
    processing_summary: detail.processing.summary,
    attention: detail.attention,
    provenance: detail.provenance,
    semantics: {
      original_binary_is_canonical: true,
      original_binary_content_available_through_this_mcp: false,
      representations_are_processor_attributed_derivations: true,
      representations_are_not_merged: true,
    },
  };
}

function sliceUnicode(text, offset, maximum) {
  const points = [...text];
  return {
    content: points.slice(offset, offset + maximum).join(""),
    total_characters: points.length,
    returned_offset: offset,
    returned_characters: Math.max(0, Math.min(maximum, points.length - offset)),
    truncated: offset + maximum < points.length,
    next_offset: offset + maximum < points.length ? offset + maximum : null,
    offset_unit: "unicode_code_points",
  };
}

export function createTextConsultationMcpTools({ client, workspaceRoot = getWorkspaceRoot() }) {
  if (!client?.query) throw new TypeError("client with query() is required");

  return async function callTool(name, args = {}) {
    assertObject(args);
    if (name === "search_document_text") {
      rejectUnknown(args, new Set(["query", "scope", "order", "limit", "offset"]));
      const query = String(args.query ?? "").trim();
      if (!query) throw toolError("SEARCH_QUERY_REQUIRED", "query must contain searchable text");
      const scope = args.scope ?? "full";
      if (!SEARCH_SCOPES.has(scope)) throw toolError("INVALID_SEARCH_SCOPE", "scope must be full or pilot");
      const order = args.order ?? "relevance";
      if (!SEARCH_ORDERS.has(order)) throw toolError("INVALID_SEARCH_ORDER", "order is invalid");
      const limit = integerArgument(args.limit, 10, { min: 1, max: 20, name: "limit" });
      const offset = integerArgument(args.offset, 0, { min: 0, name: "offset" });
      const result = await searchReferencePilot(client, query, { scope, sort: order, limit, offset });
      return {
        query: result.query,
        result_summary: result.result_summary,
        items: result.items.map(compactSearchItem),
        coverage: {
          scope,
          indexed_text_only: true,
          no_match_does_not_mean_document_absence: true,
        },
      };
    }

    if (name === "get_binary_details") {
      rejectUnknown(args, new Set(["sha256"]));
      const sha256 = String(args.sha256 ?? "").toLowerCase();
      if (!isValidSha256(sha256)) throw toolError("INVALID_SHA256", "sha256 must contain 64 hexadecimal characters");
      return compactBinaryDetail(await getConsultationBinaryDetail(client, sha256, { workspaceRoot }));
    }

    if (name === "query_court_records") {
      return queryCourtRecords(client, args);
    }

    if (name === "get_representation_content") {
      rejectUnknown(args, new Set(["representation_id", "format", "offset", "max_characters"]));
      const representationId = integerArgument(args.representation_id, undefined, {
        min: 1, name: "representation_id",
      });
      const format = String(args.format ?? "").toLowerCase();
      if (!REPRESENTATION_FORMATS.has(format)) throw toolError("INVALID_REPRESENTATION_FORMAT", "format is invalid");
      const offset = integerArgument(args.offset, 0, { min: 0, name: "offset" });
      const maxCharacters = integerArgument(args.max_characters, 12000, {
        min: 1, max: 50000, name: "max_characters",
      });
      const [representation, contentResult] = await Promise.all([
        getRepresentationById(client, representationId),
        getRepresentationContent(client, representationId, format, { workspaceRoot }),
      ]);
      const serialized = typeof contentResult.body === "string"
        ? contentResult.body
        : JSON.stringify(contentResult.body);
      return {
        representation: {
          representation_id: Number(representation.id),
          file_binary_id: Number(representation.file_binary_id),
          representation_kind: representation.representation_kind,
          representation_source_kind: representation.representation_source_kind,
          representation_variant_key: representation.representation_variant_key,
          processor_key: representation.processor_key,
          processor_version: representation.processor_version,
          based_on_representation_id: representation.based_on_representation_id,
          produced_by_job_id: representation.produced_by_job_id,
        },
        format,
        content_type: contentResult.contentType,
        ...sliceUnicode(serialized, offset, maxCharacters),
        semantics: {
          processor_attributed_derived_content: true,
          not_canonical_evidence: true,
          native_json_serialization: format === "native-json" ? "compact_json" : null,
        },
      };
    }

    throw toolError("UNKNOWN_TOOL", `unknown tool: ${name}`);
  };
}
