import type {
  BinaryCatalogueResponse,
  BinaryDetailResponse,
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

export async function listBinaries(limit = 100, offset = 0): Promise<BinaryCatalogueResponse> {
  const response = await fetch(`/api/consultation/binaries?limit=${limit}&offset=${offset}`);
  return expectJson<BinaryCatalogueResponse>(response);
}

export async function getBinaryDetail(sha256: string): Promise<BinaryDetailResponse> {
  const response = await fetch(`/api/consultation/binaries/${sha256}`);
  return expectJson<BinaryDetailResponse>(response);
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
