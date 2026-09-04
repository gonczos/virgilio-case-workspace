import { expect, test } from "vitest";

import { inspectionContext } from "./SearchInspectionPane";

test("recorded context retains missing-file state without inventing a binary", () => {
  const context = inspectionContext({
    document_id: 12,
    bucket_document_id: 34,
    case_file_id: 1,
    bucket_id: 56,
    process_number: "13608/14.8T2SNT",
    occurrence_reference: "85759502",
    occurrence_date: "2014-11-10",
    document_reference: "source-12",
    file_availability: "missing",
    binary_sha256s: [],
  });

  expect(context.file_availability).toBe("missing");
  expect(context.binary_sha256s).toEqual([]);
});

test("text result context keeps its selected binary association", () => {
  const sha256 = "a".repeat(64);
  const context = inspectionContext({
    bucket_document_id: 34,
    document_id: 12,
    process_number: "13608/14.8T2SNT",
    occurrence_reference: "85759502",
    occurrence_date: "2014-11-10",
    designation: "Despacho",
    document_reference: "source-12",
  }, [sha256]);

  expect(context.file_availability).toBe("available");
  expect(context.binary_sha256s).toEqual([sha256]);
});
