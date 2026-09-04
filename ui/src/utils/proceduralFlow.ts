import type { ProceduralFlowBucket, ProceduralFlowLane } from "../api/consultation";

export interface PositionedBucket extends ProceduralFlowBucket { x: number; y: number }
export interface ProceduralYearGroup {
  id: string; kind: "year_group"; case_file_id: number; process_number: string;
  year: string; bucket_count: number; missing_file_count: number;
  x: number; y: number; bucket_ids: number[];
}

export function positionProceduralBuckets(
  lanes: ProceduralFlowLane[], buckets: ProceduralFlowBucket[], width = 3600, laneGap = 150,
): PositionedBucket[] {
  const dates = buckets.map((bucket) => bucket.occurrence_date == null ? null : Date.parse(bucket.occurrence_date))
    .filter((value): value is number => value != null && Number.isFinite(value));
  const min = dates.length ? Math.min(...dates) : 0;
  const max = dates.length ? Math.max(...dates) : min;
  const span = Math.max(max - min, 1);
  const laneIndex = new Map(lanes.map((lane, index) => [lane.case_file_id, index]));
  const nullRanks = new Map<number, number>();
  const dateRanks = new Map<string, number>();
  return buckets.map((bucket) => {
    const timestamp = bucket.occurrence_date == null ? null : Date.parse(bucket.occurrence_date);
    const nullRank = nullRanks.get(bucket.case_file_id) ?? 0;
    if (timestamp == null || !Number.isFinite(timestamp)) nullRanks.set(bucket.case_file_id, nullRank + 1);
    const dateKey = `${bucket.case_file_id}:${bucket.occurrence_date ?? "undated"}`;
    const dateRank = dateRanks.get(dateKey) ?? 0;
    dateRanks.set(dateKey, dateRank + 1);
    return {
      ...bucket,
      x: timestamp == null || !Number.isFinite(timestamp)
        ? width + 160 + nullRank * 90
        : 80 + ((timestamp - min) / span) * width + dateRank * 7,
      y: 80 + (laneIndex.get(bucket.case_file_id) ?? 0) * laneGap + (dateRank % 5) * 8,
    };
  });
}

export function chronologicalEdges(buckets: PositionedBucket[]) {
  const byLane = new Map<number, PositionedBucket[]>();
  for (const bucket of buckets) byLane.set(bucket.case_file_id, [...(byLane.get(bucket.case_file_id) ?? []), bucket]);
  return [...byLane.values()].flatMap((items) => items.slice(0, -1).map((item, index) => ({
    data: { id: `chronology:${item.id}:${items[index + 1].id}`, source: item.id,
      target: items[index + 1].id, kind: "chronological_next", basis: "display_order" },
  })));
}

export function groupProceduralYears(buckets: PositionedBucket[]): ProceduralYearGroup[] {
  const groups = new Map<string, PositionedBucket[]>();
  for (const bucket of buckets) {
    const year = bucket.occurrence_date?.slice(0, 4) ?? "Undated";
    const key = `${bucket.case_file_id}:${year}`;
    groups.set(key, [...(groups.get(key) ?? []), bucket]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    id: `year:${key}`,
    kind: "year_group" as const,
    case_file_id: items[0].case_file_id,
    process_number: items[0].process_number,
    year: items[0].occurrence_date?.slice(0, 4) ?? "Undated",
    bucket_count: items.length,
    missing_file_count: items.filter((item) => item.file_availability === "missing").length,
    x: items.reduce((total, item) => total + item.x, 0) / items.length,
    y: Math.min(...items.map((item) => item.y)),
    bucket_ids: items.map((item) => item.bucket_id),
  })).sort((a, b) => a.case_file_id - b.case_file_id || a.x - b.x || a.id.localeCompare(b.id));
}

export function chronologicalYearEdges(groups: ProceduralYearGroup[]) {
  const byLane = new Map<number, ProceduralYearGroup[]>();
  for (const group of groups) byLane.set(group.case_file_id, [...(byLane.get(group.case_file_id) ?? []), group]);
  return [...byLane.values()].flatMap((items) => items.slice(0, -1).map((item, index) => ({
    data: { id: `year-chronology:${item.id}:${items[index + 1].id}`, source: item.id,
      target: items[index + 1].id, kind: "chronological_next", basis: "display_order" },
  })));
}

export function bucketLabel(bucket: ProceduralFlowBucket) {
  return `${bucket.occurrence_date ?? "Date unavailable"}\n${bucket.reference_number ?? bucket.designation ?? `Bucket ${bucket.bucket_id}`}`;
}

export function yearGroupLabel(group: ProceduralYearGroup) {
  return `${group.process_number}\n${group.year}\n${group.bucket_count} bucket${group.bucket_count === 1 ? "" : "s"}`;
}

export function yearExpansionGrid(bucketCount: number) {
  const columns = Math.min(12, Math.max(1, Math.round(Math.sqrt(bucketCount * 2))));
  const rows = Math.max(1, Math.ceil(bucketCount / columns));
  return { columns, rows, width: Math.max(260, columns * 46), height: Math.max(100, rows * 48) };
}
