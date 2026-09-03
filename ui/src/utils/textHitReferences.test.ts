import { expect, test } from "vitest";

import type { ReferenceObservationView } from "../types/consultation";
import { getTextHitReferenceRows } from "./textHitReferences";

const observation = (key: string) => ({
  observation: { observation_key: key },
} as ReferenceObservationView);

test("a reference present only on a secondary hit remains available", () => {
  const hits = [
    { passage_reference_observations: [], contextual_reference_observations: [] },
    { passage_reference_observations: [observation("secondary")], contextual_reference_observations: [] },
  ];
  expect(getTextHitReferenceRows(hits[0])).toEqual([]);
  expect(getTextHitReferenceRows(hits[1]).map((row) => row.item.observation.observation_key)).toEqual(["secondary"]);
});

test("passage and contextual observations keep their distinct roles", () => {
  const rows = getTextHitReferenceRows({
    passage_reference_observations: [observation("passage")],
    contextual_reference_observations: [observation("context")],
  });
  expect(rows.map(({ kind, item }) => [kind, item.observation.observation_key])).toEqual([
    ["passage", "passage"], ["contextual", "context"],
  ]);
});
