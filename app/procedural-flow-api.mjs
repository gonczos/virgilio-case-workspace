export const PROCEDURAL_FLOW_MAX_BUCKETS = 2500;
export const PROCEDURAL_FLOW_MAX_EXPANSION_NODES = 250;

const BASE_SQL = `
  SELECT cf.id AS case_file_id, cf.processo AS process_number,
         cf.parent_case_file_id, cf.is_base_case,
         b.id AS bucket_id, b.reference_number,
         to_char(b.bucket_date, 'YYYY-MM-DD') AS bucket_date,
         b.designation, b.presenter, b.document_count,
         COUNT(DISTINCT bd.document_id)::integer AS linked_document_count,
         COUNT(DISTINCT CASE WHEN db.file_binary_id IS NOT NULL THEN bd.document_id END)::integer
           AS documents_with_binary_count,
         COUNT(DISTINCT db.file_binary_id)::integer AS available_binary_count
  FROM casework.case_file cf
  LEFT JOIN casework.bucket b ON b.case_file_id = cf.id
  LEFT JOIN casework.bucket_document bd ON bd.bucket_id = b.id
  LEFT JOIN casework.document_binary db ON db.document_id = bd.document_id
  GROUP BY cf.id, cf.processo, cf.parent_case_file_id, cf.is_base_case,
           b.id, b.reference_number, b.bucket_date, b.designation,
           b.presenter, b.document_count
  ORDER BY cf.is_base_case DESC, cf.processo, b.bucket_date NULLS LAST,
           b.reference_number NULLS LAST, b.id
  LIMIT $1
`;

const EXPANSION_SQL = `
  WITH selected_documents AS (
    SELECT bd.id AS bucket_document_id, bd.document_id
    FROM casework.bucket_document bd
    WHERE bd.bucket_id = $1
  ), selected_binaries AS (
    SELECT DISTINCT db.file_binary_id
    FROM selected_documents selected
    JOIN casework.document_binary db ON db.document_id = selected.document_id
  )
  SELECT selected.bucket_document_id, d.id AS document_id,
         d.document_name, d.document_procinfo, d.document_type,
         fb.id AS file_binary_id, fb.sha256, fb.file_extension,
         related.id AS related_bucket_id,
         related.reference_number AS related_reference_number,
         to_char(related.bucket_date, 'YYYY-MM-DD') AS related_bucket_date,
         related_cf.id AS related_case_file_id,
         related_cf.processo AS related_process_number
  FROM selected_documents selected
  JOIN casework.document d ON d.id = selected.document_id
  LEFT JOIN casework.document_binary db ON db.document_id = d.id
  LEFT JOIN casework.file_binary fb ON fb.id = db.file_binary_id
  LEFT JOIN casework.document_binary reused_db
    ON reused_db.file_binary_id = fb.id
  LEFT JOIN casework.bucket_document reused_bd
    ON reused_bd.document_id = reused_db.document_id
  LEFT JOIN casework.bucket related ON related.id = reused_bd.bucket_id
  LEFT JOIN casework.case_file related_cf ON related_cf.id = related.case_file_id
  ORDER BY d.id, fb.sha256 NULLS LAST, related.bucket_date NULLS LAST,
           related.id NULLS LAST
`;

const dateString = (value) => value == null ? null
  : typeof value === "string" ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);

export function buildProceduralFlow(rows) {
  const laneMap = new Map();
  const buckets = [];
  for (const row of rows) {
    const caseFileId = Number(row.case_file_id);
    if (!laneMap.has(caseFileId)) {
      laneMap.set(caseFileId, {
        id: `case:${caseFileId}`,
        case_file_id: caseFileId,
        process_number: row.process_number,
        parent_case_file_id: row.parent_case_file_id == null ? null : Number(row.parent_case_file_id),
        is_base_case: Boolean(row.is_base_case),
      });
    }
    if (row.bucket_id == null) continue;
    const linked = Number(row.linked_document_count ?? 0);
    const available = Number(row.available_binary_count ?? 0);
    const documentsWithBinary = Number(row.documents_with_binary_count ?? (available > 0 ? linked : 0));
    buckets.push({
      id: `bucket:${row.bucket_id}`,
      kind: "bucket",
      bucket_id: Number(row.bucket_id),
      case_file_id: caseFileId,
      process_number: row.process_number,
      reference_number: row.reference_number ?? null,
      occurrence_date: dateString(row.bucket_date),
      designation: row.designation ?? null,
      presenter: row.presenter ?? null,
      source_document_count: linked,
      declared_document_count: row.document_count == null ? null : Number(row.document_count),
      available_binary_count: available,
      file_availability: documentsWithBinary === 0 ? "missing"
        : documentsWithBinary < linked ? "mixed" : "available",
      expandable: linked > 0,
    });
  }
  const lanes = [...laneMap.values()];
  return {
    lanes,
    buckets,
    coverage: {
      status: rows.length >= PROCEDURAL_FLOW_MAX_BUCKETS ? "possibly_truncated" : "complete_for_stored_case_files",
      bucket_limit: PROCEDURAL_FLOW_MAX_BUCKETS,
      date_semantics: "Recorded court-system occurrence date; not necessarily the document, signature, service, or decision date.",
    },
    limitations: [
      "Process lanes and bucket membership are source-recorded.",
      "Chronological adjacency does not assert procedural causality.",
      "Missing files remain visible and receive no open action.",
    ],
  };
}

export function buildBucketExpansion(bucketId, rows) {
  const nodes = new Map();
  const edges = new Map();
  const addNode = (node) => { if (node?.id) nodes.set(node.id, node); };
  const addEdge = (edge) => {
    const id = `${edge.kind}:${edge.source}:${edge.target}`;
    edges.set(id, { id, ...edge });
  };
  const selectedId = `bucket:${bucketId}`;
  for (const row of rows) {
    const documentId = `document:${row.document_id}`;
    addNode({ id: documentId, kind: "source_document", document_id: Number(row.document_id),
      label: row.document_name ?? row.document_procinfo ?? `Document ${row.document_id}`,
      document_reference: row.document_procinfo ?? null, document_type: row.document_type ?? null });
    addEdge({ source: selectedId, target: documentId, kind: "contains_document", basis: "source_recorded" });
    if (row.sha256 == null) continue;
    const binaryId = `binary:${row.sha256}`;
    addNode({ id: binaryId, kind: "binary", file_binary_id: Number(row.file_binary_id),
      label: row.sha256, sha256: row.sha256, file_extension: row.file_extension ?? null,
      open_action: { href: `/binaries/${row.sha256}` } });
    addEdge({ source: documentId, target: binaryId, kind: "represented_by", basis: "source_recorded" });
    if (row.related_bucket_id == null || Number(row.related_bucket_id) === Number(bucketId)) continue;
    const occurrenceId = `bucket:${row.related_bucket_id}`;
    addNode({ id: occurrenceId, kind: "related_occurrence", bucket_id: Number(row.related_bucket_id),
      case_file_id: Number(row.related_case_file_id), process_number: row.related_process_number,
      label: row.related_reference_number ?? `Bucket ${row.related_bucket_id}`,
      reference_number: row.related_reference_number ?? null,
      occurrence_date: row.related_bucket_date ?? null });
    addEdge({ source: binaryId, target: occurrenceId, kind: "same_binary_occurs_in", basis: "source_recorded" });
  }
  const allNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const selectedNodes = allNodes.slice(0, PROCEDURAL_FLOW_MAX_EXPANSION_NODES);
  const selectedIds = new Set([selectedId, ...selectedNodes.map((node) => node.id)]);
  const allEdges = [...edges.values()].filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    focus: { kind: "bucket", bucket_id: Number(bucketId) },
    nodes: selectedNodes,
    edges: allEdges,
    truncated: allNodes.length > selectedNodes.length,
    limitations: ["Same-binary edges express reuse, not equivalence of procedural purpose."],
  };
}

export async function getProceduralFlow(client) {
  const result = await client.query(BASE_SQL, [PROCEDURAL_FLOW_MAX_BUCKETS]);
  return buildProceduralFlow(result.rows);
}

export async function getBucketExpansion(client, bucketId) {
  const result = await client.query(EXPANSION_SQL, [bucketId]);
  return buildBucketExpansion(bucketId, result.rows);
}
