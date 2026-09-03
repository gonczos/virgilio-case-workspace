import type { ReferenceTextHit } from "../types/consultation";

export function mergeTextSearchHits(
  existing: ReferenceTextHit[],
  incoming: ReferenceTextHit[],
): ReferenceTextHit[] {
  const seen = new Set(existing.map((item) => String(item.segment_id)));
  const merged = [...existing];
  for (const item of incoming) {
    const key = String(item.segment_id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}
