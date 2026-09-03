import type { ReferenceObservationView, ReferenceTextHit } from "../types/consultation";

export interface TextHitReferenceRow {
  kind: "passage" | "contextual";
  item: ReferenceObservationView;
}

export function getTextHitReferenceRows(hit: Pick<
  ReferenceTextHit,
  "passage_reference_observations" | "contextual_reference_observations"
>): TextHitReferenceRow[] {
  return [
    ...hit.passage_reference_observations.map((item) => ({ kind: "passage" as const, item })),
    ...hit.contextual_reference_observations.map((item) => ({ kind: "contextual" as const, item })),
  ];
}
