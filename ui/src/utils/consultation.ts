import type {
  BinaryCatalogueItem,
  BinaryDetailResponse,
  RepresentationListItem,
} from "../types/consultation";

const FORMAT_PRIORITY = ["markdown", "text", "complete-text", "native-json"];

export function normalizeStableId(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

export function sameStableId(
  left: number | string | null | undefined,
  right: number | string | null | undefined,
): boolean {
  const normalizedLeft = normalizeStableId(left);
  const normalizedRight = normalizeStableId(right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

export function formatBytes(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "Unknown";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatFileType(mimeType: string | null, fileExtension: string | null): string {
  if (fileExtension) {
    return fileExtension.replace(/^\./u, "").toUpperCase();
  }
  if (mimeType === "application/pdf") {
    return "PDF";
  }
  if (mimeType === "text/plain") {
    return "TXT";
  }
  if (mimeType) {
    return mimeType;
  }
  return "Unknown";
}

export function getShortSha(sha256: string): string {
  return `${sha256.slice(0, 8)}...${sha256.slice(-8)}`;
}

export function getProcessingLabel(item: Pick<BinaryCatalogueItem, "processing_summary">): string {
  const counts = item.processing_summary.status_counts;
  const completed = counts.completed ?? 0;
  const failed = counts.failed ?? 0;
  const running = counts.running ?? 0;
  const queued = counts.queued ?? 0;
  if (completed > 0 && failed === 0 && running === 0 && queued === 0) {
    return "Processed";
  }
  if (completed > 0 && (failed > 0 || running > 0 || queued > 0)) {
    return "Partially processed";
  }
  if (failed > 0 && completed === 0 && running === 0 && queued === 0) {
    return "Failed";
  }
  if (running > 0 || queued > 0) {
    return "In progress";
  }
  return "Not processed";
}

export function getRepresentationLabel(representation: {
  processor_key?: string | null;
  representation_source_kind?: string | null;
} | null): string {
  if (!representation) {
    return "None";
  }
  if (representation.representation_source_kind === "human_authored") {
    return "Human";
  }
  switch (representation.processor_key) {
    case "docling":
      return "Docling";
    case "xberg":
      return "Xberg";
    case "plain_text_passthrough":
      return "Plain text";
    case "human":
      return "Human";
    default:
      return representation.processor_key ?? "Unknown";
  }
}

export function chooseInitialFormat(representation: RepresentationListItem | null): string | null {
  if (!representation || representation.available_formats.length === 0) {
    return null;
  }
  for (const preferred of FORMAT_PRIORITY) {
    if (representation.available_formats.includes(preferred)) {
      return preferred;
    }
  }
  return representation.available_formats[0] ?? null;
}

export function chooseInitialRepresentation(detail: BinaryDetailResponse): RepresentationListItem | null {
  const effectiveId = normalizeStableId(detail.representations.effective?.representation_id ?? null);
  if (effectiveId !== null) {
    const effective = detail.representations.items.find((item) => sameStableId(item.representation_id, effectiveId));
    if (effective) {
      return effective;
    }
  }
  return detail.representations.items[0] ?? null;
}

export function isPdfBinary(detail: BinaryDetailResponse): boolean {
  return detail.binary.mime_type === "application/pdf"
    || detail.binary.file_extension === ".pdf";
}
