CREATE OR REPLACE VIEW casework.v_case_summary AS
WITH bucket_counts AS (
  SELECT
    b.case_file_id,
    COUNT(*) AS bucket_count,
    MIN(b.bucket_date) AS first_bucket_date,
    MAX(b.bucket_date) AS last_bucket_date
  FROM casework.bucket AS b
  GROUP BY b.case_file_id
),
document_counts AS (
  SELECT
    b.case_file_id,
    COUNT(*) AS bucket_document_link_count,
    COUNT(DISTINCT bd.document_id) AS unique_document_count,
    COUNT(*) FILTER (WHERE bd.has_intra_bucket_duplication) AS duplicated_bucket_document_link_count
  FROM casework.bucket AS b
  JOIN casework.bucket_document AS bd
    ON bd.bucket_id = b.id
  GROUP BY b.case_file_id
),
binary_counts AS (
  SELECT
    b.case_file_id,
    COUNT(DISTINCT d.id) FILTER (WHERE db.file_binary_id IS NOT NULL) AS documents_with_binary_count,
    COUNT(DISTINCT d.id) FILTER (WHERE db.file_binary_id IS NULL) AS documents_without_binary_count,
    COUNT(DISTINCT db.file_binary_id) AS linked_file_binary_count
  FROM casework.bucket AS b
  JOIN casework.bucket_document AS bd
    ON bd.bucket_id = b.id
  JOIN casework.document AS d
    ON d.id = bd.document_id
  LEFT JOIN casework.document_binary AS db
    ON db.document_id = d.id
  GROUP BY b.case_file_id
)
SELECT
  cf.id,
  cf.court_id,
  c.country_id,
  c.tribunal_name,
  c.unit_name,
  cf.source_system,
  cf.processo,
  cf.idprocesso,
  cf.especie,
  cf.estado,
  cf.data_autuacao,
  cf.data_decisao,
  cf.parent_case_file_id,
  parent.processo AS parent_processo,
  cf.is_base_case,
  cf.case_scope_status,
  cf.canonical_confidence,
  COALESCE(bc.bucket_count, 0) AS bucket_count,
  COALESCE(dc.bucket_document_link_count, 0) AS bucket_document_link_count,
  COALESCE(dc.unique_document_count, 0) AS unique_document_count,
  COALESCE(dc.duplicated_bucket_document_link_count, 0) AS duplicated_bucket_document_link_count,
  COALESCE(bin.documents_with_binary_count, 0) AS documents_with_binary_count,
  COALESCE(bin.documents_without_binary_count, 0) AS documents_without_binary_count,
  COALESCE(bin.linked_file_binary_count, 0) AS linked_file_binary_count,
  bc.first_bucket_date,
  bc.last_bucket_date,
  cf.created_at,
  cf.updated_at
FROM casework.case_file AS cf
JOIN casework.court AS c
  ON c.id = cf.court_id
LEFT JOIN casework.case_file AS parent
  ON parent.id = cf.parent_case_file_id
LEFT JOIN bucket_counts AS bc
  ON bc.case_file_id = cf.id
LEFT JOIN document_counts AS dc
  ON dc.case_file_id = cf.id
LEFT JOIN binary_counts AS bin
  ON bin.case_file_id = cf.id;

CREATE OR REPLACE VIEW casework.v_bucket_summary AS
WITH binary_counts AS (
  SELECT
    bd.bucket_id,
    COUNT(DISTINCT bd.document_id) FILTER (WHERE db.file_binary_id IS NOT NULL) AS documents_with_binary_count,
    COUNT(DISTINCT bd.document_id) FILTER (WHERE db.file_binary_id IS NULL) AS documents_without_binary_count,
    COUNT(DISTINCT db.file_binary_id) AS linked_file_binary_count
  FROM casework.bucket_document AS bd
  LEFT JOIN casework.document_binary AS db
    ON db.document_id = bd.document_id
  GROUP BY bd.bucket_id
)
SELECT
  b.id,
  b.case_file_id,
  cf.processo,
  b.source_system,
  b.bucket_id,
  b.reference_number,
  b.bucket_date,
  b.designation,
  b.presenter,
  b.modal_title,
  b.document_count,
  b.displayed_bucket_size_bytes,
  COALESCE(SUM(bd.source_observation_count), 0) AS observed_document_occurrence_count,
  COUNT(DISTINCT bd.document_id) AS unique_document_count,
  COUNT(*) FILTER (WHERE bd.has_intra_bucket_duplication) AS duplicated_document_link_count,
  COALESCE(bin.documents_with_binary_count, 0) AS documents_with_binary_count,
  COALESCE(bin.documents_without_binary_count, 0) AS documents_without_binary_count,
  COALESCE(bin.linked_file_binary_count, 0) AS linked_file_binary_count,
  b.canonical_confidence,
  b.created_at,
  b.updated_at
FROM casework.bucket AS b
JOIN casework.case_file AS cf
  ON cf.id = b.case_file_id
LEFT JOIN casework.bucket_document AS bd
  ON bd.bucket_id = b.id
LEFT JOIN binary_counts AS bin
  ON bin.bucket_id = b.id
GROUP BY
  b.id,
  b.case_file_id,
  cf.processo,
  b.source_system,
  b.bucket_id,
  b.reference_number,
  b.bucket_date,
  b.designation,
  b.presenter,
  b.modal_title,
  b.document_count,
  b.displayed_bucket_size_bytes,
  bin.documents_with_binary_count,
  bin.documents_without_binary_count,
  bin.linked_file_binary_count,
  b.canonical_confidence,
  b.created_at,
  b.updated_at;

CREATE OR REPLACE VIEW casework.v_document_summary AS
WITH bucket_stats AS (
  SELECT
    bd.document_id,
    COUNT(*) AS bucket_link_count,
    SUM(bd.source_observation_count) AS observed_occurrence_count,
    BOOL_OR(bd.has_intra_bucket_duplication) AS has_intra_bucket_duplication,
    COUNT(DISTINCT b.case_file_id) AS case_count,
    MIN(b.bucket_date) AS first_bucket_date,
    MAX(b.bucket_date) AS last_bucket_date
  FROM casework.bucket_document AS bd
  JOIN casework.bucket AS b
    ON b.id = bd.bucket_id
  GROUP BY bd.document_id
),
binary_stats AS (
  SELECT
    db.document_id,
    COUNT(*) AS binary_link_count,
    MAX(CASE WHEN db.is_primary THEN fb.sha256 ELSE NULL END) AS primary_sha256,
    MAX(CASE WHEN db.is_primary THEN fb.file_extension ELSE NULL END) AS primary_file_extension,
    MAX(CASE WHEN db.is_primary THEN fb.mime_type ELSE NULL END) AS primary_mime_type,
    MAX(CASE WHEN db.is_primary THEN fb.actual_size_bytes ELSE NULL END) AS primary_actual_size_bytes,
    MAX(CASE WHEN db.is_primary THEN fb.retention_status ELSE NULL END) AS primary_retention_status,
    MAX(CASE WHEN db.is_primary THEN fb.integrity_check_status ELSE NULL END) AS primary_integrity_check_status,
    MAX(CASE WHEN db.is_primary THEN fb.machine_readability_status ELSE NULL END) AS primary_machine_readability_status,
    MAX(CASE WHEN db.is_primary THEN fb.page_count ELSE NULL END) AS primary_page_count,
    MAX(CASE WHEN db.is_primary THEN fb.pages_with_text ELSE NULL END) AS primary_pages_with_text,
    MAX(CASE WHEN db.is_primary THEN fb.pages_without_text ELSE NULL END) AS primary_pages_without_text,
    MAX(CASE WHEN db.is_primary THEN fb.text_coverage_ratio ELSE NULL END) AS primary_text_coverage_ratio,
    MAX(CASE WHEN db.is_primary THEN fb.total_extracted_characters ELSE NULL END) AS primary_total_extracted_characters,
    MAX(CASE WHEN db.is_primary THEN fb.storage_rel_path ELSE NULL END) AS primary_storage_rel_path
  FROM casework.document_binary AS db
  JOIN casework.file_binary AS fb
    ON fb.id = db.file_binary_id
  GROUP BY db.document_id
)
SELECT
  d.id,
  d.source_system,
  d.document_procinfo,
  d.document_name,
  d.document_anchor_title,
  d.document_date,
  d.document_type,
  d.document_type_from_attr,
  d.claimed_size_bytes,
  COALESCE(bs.bucket_link_count, 0) AS bucket_link_count,
  COALESCE(bs.observed_occurrence_count, 0) AS observed_occurrence_count,
  COALESCE(bs.has_intra_bucket_duplication, FALSE) AS has_intra_bucket_duplication,
  COALESCE(bs.case_count, 0) AS case_count,
  bs.first_bucket_date,
  bs.last_bucket_date,
  COALESCE(bin.binary_link_count, 0) AS binary_link_count,
  bin.primary_sha256,
  bin.primary_file_extension,
  bin.primary_mime_type,
  bin.primary_actual_size_bytes,
  bin.primary_retention_status,
  bin.primary_integrity_check_status,
  bin.primary_machine_readability_status,
  bin.primary_page_count,
  bin.primary_pages_with_text,
  bin.primary_pages_without_text,
  bin.primary_text_coverage_ratio,
  bin.primary_total_extracted_characters,
  bin.primary_storage_rel_path,
  d.canonical_confidence,
  d.created_at,
  d.updated_at
FROM casework.document AS d
LEFT JOIN bucket_stats AS bs
  ON bs.document_id = d.id
LEFT JOIN binary_stats AS bin
  ON bin.document_id = d.id;

CREATE OR REPLACE VIEW casework.v_unresolved_document AS
SELECT
  d.id AS document_id,
  cf.id AS case_file_id,
  cf.processo,
  b.id AS bucket_row_id,
  b.bucket_id,
  b.bucket_date,
  b.designation,
  b.presenter,
  d.document_procinfo,
  d.document_name,
  d.document_date,
  d.document_type,
  d.claimed_size_bytes,
  bd.source_observation_count,
  bd.has_intra_bucket_duplication,
  d.canonical_confidence
FROM casework.bucket_document AS bd
JOIN casework.bucket AS b
  ON b.id = bd.bucket_id
JOIN casework.case_file AS cf
  ON cf.id = b.case_file_id
JOIN casework.document AS d
  ON d.id = bd.document_id
LEFT JOIN casework.document_binary AS db
  ON db.document_id = d.id
WHERE db.id IS NULL;
