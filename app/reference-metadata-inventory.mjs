import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { normalizeReferenceValue } from "./reference-search-store.mjs";
import { withClient } from "./processing-common.mjs";

export const FIELD_CONTRACTS = {
  "case_file.processo": { origin: "court_metadata", identifier_type: "process_number", source_semantics: "Court-system proceeding number", validity_contract: "required_non_blank_database_value" },
  "case_file.idprocesso": { origin: "court_metadata", identifier_type: "source_process_id", source_semantics: "Court-system native process record identifier", validity_contract: "nullable_source_identifier_no_format_constraint" },
  "bucket.bucket_id": { origin: "court_metadata", identifier_type: "source_occurrence_id", source_semantics: "Court-system native procedural-occurrence identifier", validity_contract: "required_non_blank_database_value" },
  "bucket.reference_number": { origin: "court_metadata", identifier_type: "occurrence_reference", source_semantics: "Reference number displayed for the procedural occurrence", validity_contract: "nullable_source_reference_no_format_constraint" },
  "document.document_procinfo": { origin: "court_metadata", identifier_type: "source_document_reference", source_semantics: "Source-system document or attachment reference", validity_contract: "nullable_source_reference_no_format_constraint" },
  "case_workspace_reference.reference_value": { origin: "external_register_metadata", identifier_type: "workspace_reference", source_semantics: "Separately registered workspace-level reference", validity_contract: "required_non_blank_database_value" },
};

const INVENTORY_SQL = `
  SELECT 'case_file.processo' AS source_field, cf.id::text AS source_record_id,
         cf.processo AS raw_value, cf.processo AS process_context,
         NULL::date AS anchored_occurrence_date, NULL::text AS binary_state,
         NULL::text AS field_identifier_type
  FROM casework.case_file cf
  UNION ALL
  SELECT 'case_file.idprocesso', cf.id::text, cf.idprocesso, cf.processo,
         NULL::date, NULL::text, NULL::text
  FROM casework.case_file cf
  UNION ALL
  SELECT 'bucket.bucket_id', b.id::text, b.bucket_id, cf.processo,
         b.bucket_date,
         CASE WHEN EXISTS (
           SELECT 1 FROM casework.bucket_document bd
           JOIN casework.document_binary db ON db.document_id = bd.document_id
           WHERE bd.bucket_id = b.id
         ) THEN 'linked_binary' ELSE 'missing_or_no_binary' END,
         NULL::text
  FROM casework.bucket b
  JOIN casework.case_file cf ON cf.id = b.case_file_id
  UNION ALL
  SELECT 'bucket.reference_number', b.id::text, b.reference_number, cf.processo,
         b.bucket_date,
         CASE WHEN EXISTS (
           SELECT 1 FROM casework.bucket_document bd
           JOIN casework.document_binary db ON db.document_id = bd.document_id
           WHERE bd.bucket_id = b.id
         ) THEN 'linked_binary' ELSE 'missing_or_no_binary' END,
         NULL::text
  FROM casework.bucket b
  JOIN casework.case_file cf ON cf.id = b.case_file_id
  UNION ALL
  SELECT 'document.document_procinfo', d.id::text, d.document_procinfo,
         cf.processo, b.bucket_date,
         CASE WHEN EXISTS (
           SELECT 1 FROM casework.document_binary db WHERE db.document_id = d.id
         ) THEN 'linked_binary' ELSE 'missing_binary' END,
         NULL::text
  FROM casework.document d
  LEFT JOIN casework.bucket_document bd ON bd.document_id = d.id
  LEFT JOIN casework.bucket b ON b.id = bd.bucket_id
  LEFT JOIN casework.case_file cf ON cf.id = b.case_file_id
  UNION ALL
  SELECT 'case_workspace_reference.reference_value', cwr.id::text,
         cwr.reference_value, cf.processo, NULL::date, NULL::text,
         cwr.reference_kind
  FROM casework.case_workspace_reference cwr
  LEFT JOIN casework.case_file cf ON cf.case_workspace_id = cwr.case_workspace_id
  ORDER BY source_field, source_record_id, process_context, anchored_occurrence_date
`;

function classifyValidity(rawValue, contract) {
  if (rawValue === null || rawValue === undefined) return "empty";
  if (String(rawValue).trim() === "") return "empty_or_whitespace";
  if (contract === "required_non_blank_database_value") return "valid_by_field_contract";
  return "valid_unclassified_format";
}

export function summarizeReferenceMetadataRows(rows, pilotObservations = []) {
  const fieldReports = [];
  const populatedRows = [];
  const pilotNormalizedValues = new Set(pilotObservations.map((item) => item.normalized_value));
  for (const [sourceField, contract] of Object.entries(FIELD_CONTRACTS)) {
    const fieldRows = rows.filter((row) => row.source_field === sourceField);
    const uniqueRecords = new Map();
    for (const row of fieldRows) {
      const existing = uniqueRecords.get(row.source_record_id) ?? [];
      existing.push(row);
      uniqueRecords.set(row.source_record_id, existing);
    }
    const records = [...uniqueRecords.values()];
    const populated = records.filter((recordRows) => !classifyValidity(recordRows[0].raw_value, contract.validity_contract).startsWith("empty"));
    const validityCounts = {};
    for (const recordRows of records) {
      const classification = classifyValidity(recordRows[0].raw_value, contract.validity_contract);
      validityCounts[classification] = (validityCounts[classification] ?? 0) + 1;
    }
    const normalizedToRaw = new Map();
    for (const recordRows of populated) {
      const raw = String(recordRows[0].raw_value);
      const normalized = normalizeReferenceValue(raw);
      const rawSet = normalizedToRaw.get(normalized) ?? new Set();
      rawSet.add(raw);
      normalizedToRaw.set(normalized, rawSet);
      populatedRows.push(...recordRows.map((row) => ({ ...row, ...contract, normalized_value: normalized })));
    }
    const processCoverage = Object.fromEntries([...new Set(fieldRows.map((row) => row.process_context).filter(Boolean))]
      .sort()
      .map((processContext) => {
        const contextRows = fieldRows.filter((row) => row.process_context === processContext);
        return [processContext, {
          source_records: new Set(contextRows.map((row) => row.source_record_id)).size,
          context_rows: contextRows.length,
          linked_binary_source_records: new Set(contextRows.filter((row) => row.binary_state === "linked_binary").map((row) => row.source_record_id)).size,
          missing_or_no_binary_source_records: new Set(contextRows.filter((row) => row.binary_state?.includes("missing")).map((row) => row.source_record_id)).size,
        }];
      }));
    fieldReports.push({
      source_field: sourceField,
      ...contract,
      total_source_records: records.length,
      populated_source_records: populated.length,
      distinct_raw_values: new Set(populated.map((recordRows) => String(recordRows[0].raw_value))).size,
      distinct_normalized_values: normalizedToRaw.size,
      normalization_changed_records: populated.filter((recordRows) => String(recordRows[0].raw_value) !== normalizeReferenceValue(recordRows[0].raw_value)).length,
      within_field_collision_groups: [...normalizedToRaw.values()].filter((rawSet) => rawSet.size > 1).length,
      pilot_normalized_overlap_records: populated.filter((recordRows) => pilotNormalizedValues.has(normalizeReferenceValue(recordRows[0].raw_value))).length,
      validity_counts: validityCounts,
      process_context_count: new Set(fieldRows.map((row) => row.process_context).filter(Boolean)).size,
      process_coverage: processCoverage,
      directly_anchored_date_records: new Set(fieldRows.filter((row) => row.anchored_occurrence_date).map((row) => row.source_record_id)).size,
      linked_binary_source_records: records.filter((recordRows) => recordRows.some((row) => row.binary_state === "linked_binary")).length,
      missing_or_no_binary_source_records: records.filter((recordRows) => recordRows.some((row) => row.binary_state?.includes("missing"))).length,
      linked_binary_context_rows: fieldRows.filter((row) => row.binary_state === "linked_binary").length,
      missing_or_no_binary_context_rows: fieldRows.filter((row) => row.binary_state?.includes("missing")).length,
      context_rows_without_process: fieldRows.filter((row) => !row.process_context).length,
      provenance_reconstructable_without_inference: fieldRows.length === 0
        ? "not_assessed_no_rows"
        : fieldRows.every((row) => row.source_record_id && row.process_context)
          ? "yes"
          : "partial",
    });
  }

  const collisionMap = new Map();
  for (const row of populatedRows) {
    const entries = collisionMap.get(row.normalized_value) ?? [];
    entries.push({
      raw_value: row.raw_value,
      source_field: row.source_field,
      identifier_type: row.field_identifier_type ?? row.identifier_type,
      origin: row.origin,
      process_context: row.process_context,
      source_record_id: row.source_record_id,
      anchored_occurrence_date: row.anchored_occurrence_date,
      binary_state: row.binary_state,
    });
    collisionMap.set(row.normalized_value, entries);
  }
  const overlaps = [...collisionMap.entries()]
    .map(([normalizedValue, entries]) => {
      const sourceAssociations = [...new Map(entries.map((entry) => [
        [entry.source_field, entry.source_record_id, entry.process_context ?? "", entry.anchored_occurrence_date ?? ""].join("\u001f"),
        entry,
      ])).values()].sort((left, right) => (
        left.source_field.localeCompare(right.source_field)
        || String(left.source_record_id).localeCompare(String(right.source_record_id))
        || String(left.process_context ?? "").localeCompare(String(right.process_context ?? ""))
        || String(left.anchored_occurrence_date ?? "").localeCompare(String(right.anchored_occurrence_date ?? ""))
      ));
      return {
      normalized_value: normalizedValue,
      distinct_raw_values: [...new Set(entries.map((entry) => entry.raw_value))].sort(),
      source_fields: [...new Set(entries.map((entry) => entry.source_field))].sort(),
      identifier_types: [...new Set(entries.map((entry) => entry.identifier_type))].sort(),
      process_contexts: [...new Set(entries.map((entry) => entry.process_context).filter(Boolean))].sort(),
      observation_context_count: entries.length,
      source_record_count: new Set(entries.map((entry) => `${entry.source_field}\u001f${entry.source_record_id}`)).size,
      source_associations: sourceAssociations,
    };
    })
    .filter((item) => item.distinct_raw_values.length > 1 || item.source_fields.length > 1 || item.process_contexts.length > 1 || item.source_record_count > 1)
    .sort((left, right) => left.normalized_value.localeCompare(right.normalized_value));
  const normalizationCollisions = overlaps.filter((item) => item.distinct_raw_values.length > 1);

  return {
    inventory_version: 1,
    generated_at: new Date().toISOString(),
    read_only: true,
    normalization: "NFKC, trim, collapse whitespace, uppercase",
    field_reports: fieldReports,
    pilot_overlap: {
      observation_count: pilotObservations.reduce((sum, item) => sum + Number(item.observation_count), 0),
      distinct_normalized_values: pilotNormalizedValues.size,
    },
    normalization_collision_summary: {
      group_count: normalizationCollisions.length,
      groups: normalizationCollisions,
    },
    contextual_overlap_summary: {
      group_count: overlaps.length,
      groups: overlaps,
    },
    limitations: [
      "Validity is based only on each field's documented database contract; nullable fields have no asserted identifier grammar.",
      "Normalization changes and collisions are diagnostics, not invalidity or identity resolution.",
      "Source-observation snapshots are lineage copies and are not counted as independent reference sources.",
      "Document references linked to several occurrences produce several context rows but one source-record count.",
    ],
  };
}

export async function buildReferenceMetadataInventory(client) {
  const [result, pilotResult] = await Promise.all([
    client.query(INVENTORY_SQL),
    client.query(`
      SELECT normalized_value, COUNT(*)::int AS observation_count
      FROM casework.reference_observation
      GROUP BY normalized_value
      ORDER BY normalized_value
    `),
  ]);
  return summarizeReferenceMetadataRows(result.rows, pilotResult.rows);
}

async function main() {
  await withClient("reference-metadata-inventory", async (client) => {
    const report = await buildReferenceMetadataInventory(client);
    const includeOverlapDetails = process.argv.includes("--include-overlap-details");
    const output = includeOverlapDetails ? report : {
      ...report,
      normalization_collision_summary: {
        group_count: report.normalization_collision_summary.group_count,
        details_included: false,
      },
      contextual_overlap_summary: {
        group_count: report.contextual_overlap_summary.group_count,
        details_included: false,
      },
    };
    console.log(JSON.stringify(output, null, 2));
  });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
