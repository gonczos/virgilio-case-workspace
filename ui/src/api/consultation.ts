import type {
  BinaryCatalogueResponse,
  BinaryDetailResponse,
  ExtractionCoverageReport,
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
    const message = typeof payload === "object" && payload !== null && "error" in payload
      ? String((payload as { error: string }).error)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function normalizeRepresentationItems(value: unknown): RepresentationListItem[] {
  return Array.isArray(value) ? value as RepresentationListItem[] : [];
}

export function normalizeBinaryDetailResponse(detail: BinaryDetailResponse): BinaryDetailResponse {
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
