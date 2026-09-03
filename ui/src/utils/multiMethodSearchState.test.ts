import { describe, expect, test } from "vitest";

import {
  beginTextOrderReplacement, completeTextOrderReplacement,
  failTextOrderReplacement, isCurrentSectionRequest, participatingSections,
} from "./multiMethodSearchState";

describe("multi-method submitted search state", () => {
  test("Both to single method to Both requires fresh participating sections", () => {
    expect(participatingSections("both")).toEqual({ text: true, references: true });
    expect(participatingSections("document_text")).toEqual({ text: true, references: false });
    expect(participatingSections("both")).toEqual({ text: true, references: true });
  });

  test("a new generation invalidates both old section requests", () => {
    expect(isCurrentSectionRequest(2, 7, 1, 7)).toBe(false);
    expect(isCurrentSectionRequest(2, 7, 2, 6)).toBe(false);
    expect(isCurrentSectionRequest(2, 7, 2, 7)).toBe(true);
  });

  test("requested order does not relabel displayed results until success", () => {
    const initial = { displayedSort: "relevance" as const, requestedSort: "relevance" as const, sorting: false, sortError: null };
    const loading = beginTextOrderReplacement(initial, "earliest_occurrence_asc");
    expect(loading.displayedSort).toBe("relevance");
    expect(loading.requestedSort).toBe("earliest_occurrence_asc");
    expect(failTextOrderReplacement(loading, "failed")).toMatchObject({ displayedSort: "relevance", requestedSort: "earliest_occurrence_asc", sortError: "failed" });
    expect(completeTextOrderReplacement(loading)).toMatchObject({ displayedSort: "earliest_occurrence_asc", sorting: false });
  });
});
