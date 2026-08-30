ALTER TABLE casework.file_binary
ADD COLUMN IF NOT EXISTS storage_package_id TEXT NULL;

UPDATE casework.file_binary
SET storage_package_id = 'tribunais-portable-case-package-13608-14-8t2snt-2026-08-30T05-26-33-368Z'
WHERE storage_package_id IS NULL;

DROP VIEW IF EXISTS casework.v_document_summary;

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
    MAX(CASE WHEN db.is_primary THEN fb.storage_package_id ELSE NULL END) AS primary_storage_package_id,
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
  bin.primary_storage_package_id,
  bin.primary_storage_rel_path,
  d.canonical_confidence,
  d.created_at,
  d.updated_at
FROM casework.document AS d
LEFT JOIN bucket_stats AS bs
  ON bs.document_id = d.id
LEFT JOIN binary_stats AS bin
  ON bin.document_id = d.id;
