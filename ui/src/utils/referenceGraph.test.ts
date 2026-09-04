import { describe, expect, it } from "vitest";
import { graphNodeLabel, visibleGraphEdges } from "./referenceGraph";

describe("reference graph presentation", () => {
  it("uses readable labels without discarding full identity", () => {
    expect(graphNodeLabel({ id: "binary:x", kind: "binary", label: "a".repeat(64), sha256: "a".repeat(64) })).toBe("Binary\naaaaaaaa…");
    expect(graphNodeLabel({ id: "observation:x", kind: "reference_observation", label: "105398957", origin: "document_text" })).toBe("Text citation");
  });
  it("suppresses a generic duplicate when a direct anchor exists", () => {
    const edges = [
      { id: "a", source: "o", target: "x", kind: "associated_with", basis: "source_recorded" as const },
      { id: "b", source: "o", target: "x", kind: "directly_anchored_in", basis: "source_recorded" as const },
    ];
    expect(visibleGraphEdges(edges).map((edge) => edge.id)).toEqual(["b"]);
  });
});
