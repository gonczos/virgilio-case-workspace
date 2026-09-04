import { describe, expect, it } from "vitest";
import { chronologicalEdges, chronologicalYearEdges, groupProceduralYears, positionProceduralBuckets,
  yearGroupLabel } from "./proceduralFlow";
import { adjacentProceduralBuckets, isExpandableOccurrenceKind, yearExpansionGrid } from "./proceduralFlow";

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
  it("starts with one chronological group per process and year", () => {
    const positioned = positionProceduralBuckets(lanes, [bucket(1, 1, "2020-01-01"),
      bucket(2, 1, "2020-03-01"), bucket(3, 1, "2021-01-01"), bucket(4, 2, "2020-01-01")]);
    const groups = groupProceduralYears(positioned);
    expect(groups).toHaveLength(3);
    expect(groups.find((group) => group.id === "year:1:2020")?.bucket_count).toBe(2);
    expect(chronologicalYearEdges(groups)).toHaveLength(1);
    expect(yearGroupLabel(groups.find((group) => group.id === "year:1:2020")!)).toBe("P\n2020\n2 buckets");
  });
  it("sizes a revealed year into a bounded local grid", () => {
    expect(yearExpansionGrid(1)).toEqual({ columns: 1, rows: 1, width: 260, height: 100 });
    expect(yearExpansionGrid(80)).toEqual({ columns: 12, rows: 7, width: 552, height: 336 });
  });
  it("finds only the previous and next bucket in the same process", () => {
    const buckets = [bucket(1, 1, "2020-01-01"), bucket(2, 1, "2020-02-01"),
      bucket(3, 1, "2020-03-01"), bucket(4, 2, "2020-02-01")];
    expect(adjacentProceduralBuckets(buckets, 2).map((item) => item.bucket_id)).toEqual([1, 3]);
  });
  it("allows source and reused occurrence nodes to continue exploration", () => {
    expect(isExpandableOccurrenceKind("bucket")).toBe(true);
    expect(isExpandableOccurrenceKind("related_occurrence")).toBe(true);
    expect(isExpandableOccurrenceKind("binary")).toBe(false);
  });
});
