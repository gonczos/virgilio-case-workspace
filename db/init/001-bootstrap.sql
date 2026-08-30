CREATE SCHEMA IF NOT EXISTS casework;

CREATE TABLE IF NOT EXISTS casework.import_batch (
  id BIGSERIAL PRIMARY KEY,
  package_id TEXT NOT NULL UNIQUE,
  package_kind TEXT NOT NULL,
  source_system TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  producer TEXT NULL,
  created_at_source TIMESTAMPTZ NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  case_count INTEGER NULL,
  document_count INTEGER NULL,
  file_binary_count INTEGER NULL,
  package_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS casework.country (
  id CHAR(2) PRIMARY KEY,
  country_name TEXT NOT NULL,
  iso_alpha3 CHAR(3) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casework.court (
  id BIGSERIAL PRIMARY KEY,
  country_id CHAR(2) NOT NULL REFERENCES casework.country(id),
  source_system TEXT NOT NULL,
  tribunal_name TEXT NOT NULL,
  unit_name TEXT NULL,
  idtribref TEXT NULL,
  idunorgref TEXT NULL,
  idcliente TEXT NULL,
  canonical_confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, idtribref, idunorgref, idcliente)
);

CREATE TABLE IF NOT EXISTS casework.case_file (
  id BIGSERIAL PRIMARY KEY,
  court_id BIGINT NOT NULL REFERENCES casework.court(id),
  source_system TEXT NOT NULL,
  processo TEXT NOT NULL,
  idprocesso TEXT NULL,
  especie TEXT NULL,
  estado TEXT NULL,
  data_autuacao DATE NULL,
  data_decisao DATE NULL,
  parent_case_file_id BIGINT NULL REFERENCES casework.case_file(id),
  is_base_case BOOLEAN NOT NULL DEFAULT FALSE,
  case_scope_status TEXT NOT NULL,
  canonical_confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, processo),
  UNIQUE (source_system, idprocesso)
);

CREATE TABLE IF NOT EXISTS casework.bucket (
  id BIGSERIAL PRIMARY KEY,
  case_file_id BIGINT NOT NULL REFERENCES casework.case_file(id),
  source_system TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  reference_number TEXT NULL,
  bucket_date DATE NULL,
  designation TEXT NULL,
  presenter TEXT NULL,
  modal_title TEXT NULL,
  document_count INTEGER NULL,
  displayed_bucket_size_bytes BIGINT NULL,
  canonical_confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_file_id, bucket_id)
);

CREATE TABLE IF NOT EXISTS casework.document (
  id BIGSERIAL PRIMARY KEY,
  source_system TEXT NOT NULL,
  document_procinfo TEXT NULL,
  document_name TEXT NULL,
  document_anchor_title TEXT NULL,
  document_date DATE NULL,
  document_type TEXT NULL,
  document_type_from_attr TEXT NULL,
  claimed_size_bytes BIGINT NULL,
  canonical_confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_source_identity
ON casework.document (
  source_system,
  document_procinfo,
  document_name,
  document_date,
  document_type,
  claimed_size_bytes
);

CREATE TABLE IF NOT EXISTS casework.bucket_document (
  id BIGSERIAL PRIMARY KEY,
  bucket_id BIGINT NOT NULL REFERENCES casework.bucket(id),
  document_id BIGINT NOT NULL REFERENCES casework.document(id),
  source_observation_count INTEGER NOT NULL,
  has_intra_bucket_duplication BOOLEAN NOT NULL,
  canonical_confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket_id, document_id)
);

CREATE TABLE IF NOT EXISTS casework.file_binary (
  id BIGSERIAL PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  actual_size_bytes BIGINT NOT NULL,
  mime_type TEXT NULL,
  file_extension TEXT NULL,
  storage_package_id TEXT NULL,
  storage_rel_path TEXT NULL,
  retention_status TEXT NOT NULL,
  integrity_check_status TEXT NULL,
  integrity_checked_at TIMESTAMPTZ NULL,
  integrity_checker TEXT NULL,
  machine_readability_status TEXT NULL,
  machine_readability_checked_at TIMESTAMPTZ NULL,
  page_count INTEGER NULL,
  pages_with_text INTEGER NULL,
  pages_without_text INTEGER NULL,
  text_coverage_ratio NUMERIC(12,6) NULL,
  total_extracted_characters BIGINT NULL,
  page_text_report_json JSONB NULL,
  canonical_confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casework.document_binary (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES casework.document(id),
  file_binary_id BIGINT NOT NULL REFERENCES casework.file_binary(id),
  source_observation_count INTEGER NOT NULL,
  is_primary BOOLEAN NOT NULL,
  match_confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, file_binary_id)
);

CREATE TABLE IF NOT EXISTS casework.consultation_note (
  id BIGSERIAL PRIMARY KEY,
  case_file_id BIGINT NULL REFERENCES casework.case_file(id),
  bucket_id BIGINT NULL REFERENCES casework.bucket(id),
  document_id BIGINT NULL REFERENCES casework.document(id),
  file_binary_id BIGINT NULL REFERENCES casework.file_binary(id),
  note_kind TEXT NOT NULL,
  note_text TEXT NOT NULL,
  author_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casework.document_issue (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES casework.document(id),
  issue_kind TEXT NOT NULL,
  issue_status TEXT NOT NULL,
  severity TEXT NULL,
  details TEXT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_bucket_case_file_id ON casework.bucket(case_file_id);
CREATE INDEX IF NOT EXISTS ix_bucket_bucket_date ON casework.bucket(bucket_date);
CREATE INDEX IF NOT EXISTS ix_bucket_document_document_id ON casework.bucket_document(document_id);
CREATE INDEX IF NOT EXISTS ix_document_document_procinfo ON casework.document(document_procinfo);
CREATE INDEX IF NOT EXISTS ix_document_document_date ON casework.document(document_date);
CREATE INDEX IF NOT EXISTS ix_document_binary_file_binary_id ON casework.document_binary(file_binary_id);
CREATE INDEX IF NOT EXISTS ix_consultation_note_case_file_id ON casework.consultation_note(case_file_id);
CREATE INDEX IF NOT EXISTS ix_consultation_note_document_id ON casework.consultation_note(document_id);
CREATE INDEX IF NOT EXISTS ix_document_issue_document_id ON casework.document_issue(document_id);

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

INSERT INTO casework.country (id, country_name, iso_alpha3)
VALUES
  ('PT', 'Portugal', 'PRT'),
  ('FR', 'France', 'FRA')
ON CONFLICT (id) DO UPDATE
SET
  country_name = EXCLUDED.country_name,
  iso_alpha3 = EXCLUDED.iso_alpha3;
