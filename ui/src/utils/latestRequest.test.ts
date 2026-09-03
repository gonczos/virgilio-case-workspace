import { expect, test } from "vitest";

import { createLatestRequestTracker } from "./latestRequest";

test("only the latest overlapping request remains current", () => {
  const tracker = createLatestRequestTracker();
  const first = tracker.begin();
  const second = tracker.begin();

  expect(first.isCurrent()).toBe(false);
  expect(second.isCurrent()).toBe(true);
});
