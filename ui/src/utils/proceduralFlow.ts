import type { ProceduralFlowBucket, ProceduralFlowLane } from "../api/consultation";

export interface PositionedBucket extends ProceduralFlowBucket { x: number; y: number }

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

export function bucketLabel(bucket: ProceduralFlowBucket) {
  return `${bucket.occurrence_date ?? "Date unavailable"}\n${bucket.reference_number ?? bucket.designation ?? `Bucket ${bucket.bucket_id}`}`;
}
