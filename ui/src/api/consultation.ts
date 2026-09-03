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

async function expectJson<T>(response: Response): Promise<T> {
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
  const response = await fetch(`/api/consultation/binaries?limit=${limit}&offset=${offset}`);
  return expectJson<BinaryCatalogueResponse>(response);
}

export async function getExtractionCoverageReport(): Promise<ExtractionCoverageReport> {
  const response = await fetch("/api/consultation/reports/extraction-coverage");
  return expectJson<ExtractionCoverageReport>(response);
}

export async function lookupPilotReference(value: string): Promise<ReferenceLookupResponse> {
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
  const response = await fetch(`/api/consultation/references/lookup?${params.toString()}`);
  return expectJson<RecordedReferenceLookupResponse>(response);
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
  const response = await fetch(`/api/consultation/reference-pilot/search?${params.toString()}`);
  return expectJson<ReferenceTextSearchResponse>(response);
}

export async function getBinaryDetail(sha256: string): Promise<BinaryDetailResponse> {
  const response = await fetch(`/api/consultation/binaries/${sha256}`);
  const payload = await expectJson<BinaryDetailResponse>(response);
  return normalizeBinaryDetailResponse(payload);
}

export async function getRepresentationContent(
  representationId: number,
  format: string,
): Promise<RepresentationContentResult> {
  const response = await fetch(
    `/api/consultation/representations/${representationId}/content?format=${encodeURIComponent(format)}`,
  );
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
