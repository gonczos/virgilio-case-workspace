import type {
  BinaryCatalogueResponse,
  BinaryDetailResponse,
  ExtractionCoverageReport,
  ReferenceLookupResponse,
  RecordedReferenceLifecycle,
  RecordedReferenceLookupResponse,
  RecordedReferenceScope,
  ReferenceTextSearchResponse,
  RepresentationListItem,
  RepresentationContentResult,
} from "../types/consultation";

const releaseMode = import.meta.env.VITE_CONSULTATION_V1 === "true";
const consultationBase = releaseMode ? "/api/v1" : "/api/consultation";

export interface ReferenceGraphNode {
  id: string; kind: string; label: string | null; sha256?: string;
  open_action?: { href: string }; [key: string]: unknown;
}
export interface ReferenceGraphEdge {
  id: string; source: string; target: string; kind: string; basis: "observed" | "source_recorded";
}
export interface ReferenceGraphResponse {
  fixture: { reference_value: string; normalized_value: string; scope: string; lifecycle: string; depth: number; limits: { nodes: number; edges: number }; truncated: boolean };
  nodes: ReferenceGraphNode[]; edges: ReferenceGraphEdge[];
  coverage: { status: string }; limitations: string[];
}

export interface ProceduralFlowLane {
  id: string; case_file_id: number; process_number: string;
  parent_case_file_id: number | null; is_base_case: boolean;
}
export interface ProceduralFlowBucket {
  id: string; kind: "bucket"; bucket_id: number; case_file_id: number;
  process_number: string; reference_number: string | null; occurrence_date: string | null;
  designation: string | null; presenter: string | null; source_document_count: number;
  available_binary_count: number; file_availability: "available" | "mixed" | "missing";
  expandable: boolean;
}
export interface ProceduralFlowResponse {
  lanes: ProceduralFlowLane[]; buckets: ProceduralFlowBucket[];
  coverage: { status: string; bucket_limit: number; date_semantics: string };
  limitations: string[];
}
export interface ProceduralFlowGraphNode {
  id: string; kind: string; label: string; sha256?: string;
  process_number?: string; occurrence_date?: string | null;
  open_action?: { href: string }; [key: string]: unknown;
}
export interface ProceduralFlowGraphEdge {
  id: string; source: string; target: string; kind: string; basis: "source_recorded";
}
export interface BucketExpansionResponse {
  focus: { kind: "bucket"; bucket_id: number };
  nodes: ProceduralFlowGraphNode[]; edges: ProceduralFlowGraphEdge[];
  truncated: boolean; limitations: string[];
}

export function requireAuthenticatedResponse(response: Response): void {
  if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/api/")) {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.dispatchEvent(new Event("consultation-auth-required"));
    window.location.replace(`/api/v1/auth/login?return_to=${encodeURIComponent(returnTo)}`);
    throw new Error("Authentication required");
  }
}

async function expectJson<T>(response: Response): Promise<T> {
  requireAuthenticatedResponse(response);
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const error = typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error: unknown }).error : null;
    const message = typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : typeof error === "string" ? error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function normalizeRepresentationItems(value: unknown): RepresentationListItem[] {
  return Array.isArray(value) ? value as RepresentationListItem[] : [];
}

type NormalizableBinaryDetailResponse = Omit<BinaryDetailResponse, "evidence" | "technical_details"> & {
  evidence?: BinaryDetailResponse["evidence"];
  technical_details: Partial<BinaryDetailResponse["technical_details"]> & {
    binary_id: number;
  };
};

export function normalizeBinaryDetailResponse(detail: NormalizableBinaryDetailResponse): BinaryDetailResponse {
  return {
    ...detail,
    representations: {
      ...detail.representations,
      items: normalizeRepresentationItems(detail.representations?.items),
    },
    evidence: {
      items: normalizeRepresentationItems(detail.evidence?.items),
    },
    technical_details: {
      ...detail.technical_details,
      interpretation_representation_ids: Array.isArray(detail.technical_details?.interpretation_representation_ids)
        ? detail.technical_details.interpretation_representation_ids
        : normalizeRepresentationItems(detail.representations?.items).map((item) => item.representation_id),
      evidence_representation_ids: Array.isArray(detail.technical_details?.evidence_representation_ids)
        ? detail.technical_details.evidence_representation_ids
        : normalizeRepresentationItems(detail.evidence?.items).map((item) => item.representation_id),
      representation_ids: Array.isArray(detail.technical_details?.representation_ids)
        ? detail.technical_details.representation_ids
        : normalizeRepresentationItems(detail.representations?.items).map((item) => item.representation_id),
      comparison_ids: Array.isArray(detail.technical_details?.comparison_ids)
        ? detail.technical_details.comparison_ids
        : [],
    },
  };
}

export async function listBinaries(limit = 100, offset = 0): Promise<BinaryCatalogueResponse> {
  const response = await fetch(`${consultationBase}/binaries?limit=${limit}&offset=${offset}`);
  return expectJson<BinaryCatalogueResponse>(response);
}

export async function getExtractionCoverageReport(): Promise<ExtractionCoverageReport> {
  if (import.meta.env.VITE_CONSULTATION_V1 === "true") throw new Error("Not available in Consultation V1");
  const response = await fetch("/api/consultation/reports/extraction-coverage");
  return expectJson<ExtractionCoverageReport>(response);
}

export async function lookupPilotReference(value: string): Promise<ReferenceLookupResponse> {
  if (import.meta.env.VITE_CONSULTATION_V1 === "true") throw new Error("Not available in Consultation V1");
  const response = await fetch(
    `/api/consultation/reference-pilot/references/${encodeURIComponent(value)}`,
  );
  return expectJson<ReferenceLookupResponse>(response);
}

export async function lookupRecordedReferences(
  value: string,
  {
    scope = "full",
    lifecycle = "current",
    limit = 50,
    offset = 0,
  }: {
    scope?: RecordedReferenceScope;
    lifecycle?: RecordedReferenceLifecycle;
    limit?: number;
    offset?: number;
  } = {},
): Promise<RecordedReferenceLookupResponse> {
  const params = new URLSearchParams({
    value, scope, lifecycle, limit: String(limit), offset: String(offset),
  });
  const response = await fetch(`${consultationBase}/references/lookup?${params.toString()}`);
  return expectJson<RecordedReferenceLookupResponse>(response);
}

export async function getReferenceGraph(value: string): Promise<ReferenceGraphResponse> {
  if (import.meta.env.VITE_CONSULTATION_V1 === "true") throw new Error("Not available in Consultation V1");
  const response = await fetch(`/api/consultation/graphs/references/${encodeURIComponent(value)}?scope=pilot&lifecycle=current`);
  return expectJson<ReferenceGraphResponse>(response);
}

export async function getProceduralFlow(): Promise<ProceduralFlowResponse> {
  if (import.meta.env.VITE_CONSULTATION_V1 === "true") throw new Error("Not available in Consultation V1");
  return expectJson<ProceduralFlowResponse>(await fetch("/api/consultation/graphs/procedural-flow"));
}

export async function getProceduralBucketExpansion(bucketId: number): Promise<BucketExpansionResponse> {
  if (import.meta.env.VITE_CONSULTATION_V1 === "true") throw new Error("Not available in Consultation V1");
  return expectJson<BucketExpansionResponse>(await fetch(
    `/api/consultation/graphs/procedural-flow/buckets/${bucketId}`,
  ));
}

export async function searchText(
  query: string,
  {
    limit = 50,
    offset = 0,
    scope = "pilot",
    sort = "relevance",
  }: {
    limit?: number;
    offset?: number;
    scope?: "pilot" | "full";
    sort?: "relevance" | "earliest_occurrence_asc" | "latest_occurrence_desc";
  } = {},
): Promise<ReferenceTextSearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset), scope, sort });
  const searchPath = releaseMode ? "search" : "reference-pilot/search";
  const response = await fetch(`${consultationBase}/${searchPath}?${params.toString()}`);
  return expectJson<ReferenceTextSearchResponse>(response);
}

export async function getBinaryDetail(sha256: string): Promise<BinaryDetailResponse> {
  const response = await fetch(`${consultationBase}/binaries/${sha256}`);
  const payload = await expectJson<BinaryDetailResponse>(response);
  return normalizeBinaryDetailResponse(payload);
}

export async function getRepresentationContent(
  representationId: number,
  format: string,
): Promise<RepresentationContentResult> {
  const response = await fetch(
    `${consultationBase}/representations/${representationId}/content?format=${encodeURIComponent(format)}`,
  );
  requireAuthenticatedResponse(response);
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const message = typeof payload === "object" && payload !== null && "error" in payload
      ? String((payload as { error: string }).error)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (format === "native-json") {
    return { format: "native-json", body: await response.json() };
  }
  return {
    format: format === "markdown" ? "markdown" : format === "complete-text" ? "complete-text" : "text",
    body: await response.text(),
  };
}
