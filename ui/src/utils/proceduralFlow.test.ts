import { describe, expect, it } from "vitest";
import { chronologicalEdges, positionProceduralBuckets } from "./proceduralFlow";

const lanes = [
  { id: "case:1", case_file_id: 1, process_number: "P", parent_case_file_id: null, is_base_case: true },
  { id: "case:2", case_file_id: 2, process_number: "P-A", parent_case_file_id: 1, is_base_case: false },
];
const bucket = (id: number, caseId: number, date: string | null) => ({ id: `bucket:${id}`,
  kind: "bucket" as const, bucket_id: id, case_file_id: caseId, process_number: "P",
  reference_number: `R${id}`, occurrence_date: date, designation: null, presenter: null,
  source_document_count: 1, available_binary_count: 1, file_availability: "available" as const,
  expandable: true });

describe("procedural flow positioning", () => {
  it("shares a time axis while keeping cases in separate lanes", () => {
    const result = positionProceduralBuckets(lanes, [bucket(1, 1, "2020-01-01"), bucket(2, 2, "2020-01-01")]);
    expect(result[0].x).toBe(result[1].x);
    expect(result[0].y).not.toBe(result[1].y);
  });
  it("connects only consecutive buckets within each lane", () => {
    const result = positionProceduralBuckets(lanes, [bucket(1, 1, "2020-01-01"), bucket(2, 1, "2020-02-01"), bucket(3, 2, "2020-01-01")]);
    expect(chronologicalEdges(result)).toHaveLength(1);
  });
  it("keeps same-day buckets separately selectable", () => {
    const result = positionProceduralBuckets(lanes, [bucket(1, 1, "2020-01-01"), bucket(2, 1, "2020-01-01")]);
    expect(result[0].x).not.toBe(result[1].x);
    expect(result[0].y).not.toBe(result[1].y);
  });
});
