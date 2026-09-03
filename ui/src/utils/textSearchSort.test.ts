import { expect, test } from "vitest";

import { shouldRestartTextSearchForSort } from "./textSearchSort";

test("does not restart a completed query while a newer search is pending", () => {
  expect(shouldRestartTextSearchForSort({
    initialSearchPending: true,
    submittedMode: "text",
  })).toBe(false);
});

test("restarts the displayed text query when no initial search is pending", () => {
  expect(shouldRestartTextSearchForSort({
    initialSearchPending: false,
    submittedMode: "text",
  })).toBe(true);
});
