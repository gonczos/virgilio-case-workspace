CREATE SCHEMA IF NOT EXISTS casework;

CREATE TABLE IF NOT EXISTS casework.source_capture (
  id BIGSERIAL PRIMARY KEY,
  source_system TEXT NOT NULL,
  capture_kind TEXT NOT NULL,
  capture_key TEXT NULL,
  external_source_label TEXT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  scraper_key TEXT NULL,
  scraper_version TEXT NULL,
  source_locator TEXT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (capture_kind IN ('portable_package_export', 'live_scrape_snapshot', 'manual_source_capture'))
);

CREATE TABLE IF NOT EXISTS casework.import_batch (
  id BIGSERIAL PRIMARY KEY,
  package_id TEXT NOT NULL UNIQUE,
  source_capture_id BIGINT NULL REFERENCES casework.source_capture(id),
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

CREATE TABLE IF NOT EXISTS casework.case_workspace (
  id BIGSERIAL PRIMARY KEY,
  workspace_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NULL,
  lifecycle_status TEXT NOT NULL,
  primary_country_id CHAR(2) NULL REFERENCES casework.country(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (lifecycle_status IN ('prospective', 'preparing', 'filed', 'active', 'closed', 'archived'))
);

CREATE TABLE IF NOT EXISTS casework.case_workspace_reference (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL REFERENCES casework.case_workspace(id) ON DELETE CASCADE,
  reference_kind TEXT NOT NULL,
  country_id CHAR(2) NULL REFERENCES casework.country(id),
  court_name TEXT NULL,
  reference_value TEXT NOT NULL,
  reference_label TEXT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from DATE NULL,
  valid_to DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reference_kind IN ('external_reference', 'internal_reference', 'prospective_reference')),
  CHECK (BTRIM(reference_value) <> ''),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS casework.case_file (
  id BIGSERIAL PRIMARY KEY,
  court_id BIGINT NOT NULL REFERENCES casework.court(id),
  case_workspace_id BIGINT NULL REFERENCES casework.case_workspace(id),
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
  CONSTRAINT case_file_id_case_workspace_id_key
    UNIQUE (id, case_workspace_id),
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
  document_identity_class TEXT NOT NULL DEFAULT 'imported_source_keyed',
  source_system TEXT NULL,
  document_procinfo TEXT NULL,
  document_name TEXT NULL,
  document_anchor_title TEXT NULL,
  document_date DATE NULL,
  document_type TEXT NULL,
  document_type_from_attr TEXT NULL,
  claimed_size_bytes BIGINT NULL,
  canonical_confidence TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (document_identity_class IN ('imported_source_keyed', 'workspace_native')),
  CHECK (document_identity_class <> 'imported_source_keyed' OR source_system IS NOT NULL),
  CHECK (document_identity_class <> 'imported_source_keyed' OR canonical_confidence IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_imported_source_identity
ON casework.document (
  source_system,
  document_procinfo,
  document_name,
  document_date,
  document_type,
  claimed_size_bytes
)
WHERE document_identity_class = 'imported_source_keyed';

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

CREATE TABLE IF NOT EXISTS casework.processing_job (
  id BIGSERIAL PRIMARY KEY,
  stage_key TEXT NOT NULL,
  status TEXT NOT NULL,
  file_binary_id BIGINT NULL,
  document_representation_id BIGINT NULL,
  processor_key TEXT NOT NULL,
  processor_version TEXT NOT NULL,
  requested_by TEXT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_code TEXT NULL,
  error_text TEXT NULL,
  depends_on_job_id BIGINT NULL,
  CONSTRAINT processing_job_file_binary_id_fkey
    FOREIGN KEY (file_binary_id)
    REFERENCES casework.file_binary(id)
    ON DELETE RESTRICT,
  CONSTRAINT processing_job_depends_on_job_id_fkey
    FOREIGN KEY (depends_on_job_id)
    REFERENCES casework.processing_job(id)
    ON DELETE RESTRICT,
  CONSTRAINT processing_job_exactly_one_target_check
    CHECK (num_nonnulls(file_binary_id, document_representation_id) = 1),
  CONSTRAINT processing_job_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'blocked')),
  CONSTRAINT processing_job_max_attempts_check
    CHECK (max_attempts >= 1),
  CONSTRAINT processing_job_attempt_count_check
    CHECK (attempt_count >= 0),
  CONSTRAINT processing_job_no_self_dependency_check
    CHECK (depends_on_job_id IS NULL OR depends_on_job_id <> id)
);

CREATE TABLE IF NOT EXISTS casework.document_representation (
  id BIGSERIAL PRIMARY KEY,
  file_binary_id BIGINT NOT NULL,
  produced_by_job_id BIGINT NOT NULL,
  representation_kind TEXT NOT NULL,
  format_family TEXT NOT NULL,
  processor_key TEXT NOT NULL,
  processor_version TEXT NOT NULL,
  representation_source_kind TEXT NOT NULL DEFAULT 'machine_generated',
  representation_variant_key TEXT NOT NULL DEFAULT '',
  based_on_representation_id BIGINT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_json JSONB NULL,
  artifact_rel_path TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_representation_file_binary_id_fkey
    FOREIGN KEY (file_binary_id)
    REFERENCES casework.file_binary(id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_produced_by_job_id_fkey
    FOREIGN KEY (produced_by_job_id)
    REFERENCES casework.processing_job(id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_based_on_representation_id_fkey
    FOREIGN KEY (based_on_representation_id)
    REFERENCES casework.document_representation(id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_output_identity_key
    UNIQUE (file_binary_id, representation_kind, processor_key, processor_version, representation_variant_key),
  CONSTRAINT document_representation_id_file_binary_id_key
    UNIQUE (id, file_binary_id),
  CONSTRAINT document_representation_produced_by_job_id_key
    UNIQUE (produced_by_job_id),
  CONSTRAINT document_representation_source_kind_check
    CHECK (representation_source_kind IN ('machine_generated', 'human_authored')),
  CONSTRAINT document_representation_variant_key_not_blank_check
    CHECK (representation_variant_key = '' OR BTRIM(representation_variant_key) <> '')
);

ALTER TABLE casework.processing_job
ADD CONSTRAINT processing_job_document_representation_id_fkey
FOREIGN KEY (document_representation_id)
REFERENCES casework.document_representation(id)
ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS casework.document_segment (
  id BIGSERIAL PRIMARY KEY,
  document_representation_id BIGINT NOT NULL,
  segment_kind TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  text_content TEXT NULL,
  structural_path TEXT NULL,
  page_no INTEGER NULL,
  char_start INTEGER NULL,
  char_end INTEGER NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', COALESCE(text_content, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_segment_document_representation_id_fkey
    FOREIGN KEY (document_representation_id)
    REFERENCES casework.document_representation(id)
    ON DELETE CASCADE,
  CONSTRAINT document_segment_sequence_no_check
    CHECK (sequence_no >= 1),
  CONSTRAINT document_segment_char_start_check
    CHECK (char_start IS NULL OR char_start >= 0),
  CONSTRAINT document_segment_char_end_check
    CHECK (char_end IS NULL OR char_end >= 0),
  CONSTRAINT document_segment_char_order_check
    CHECK (char_start IS NULL OR char_end IS NULL OR char_end >= char_start),
  CONSTRAINT document_segment_representation_sequence_key
    UNIQUE (document_representation_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS ix_document_segment_search_vector
ON casework.document_segment USING GIN(search_vector);

CREATE TABLE IF NOT EXISTS casework.reference_observation (
  id BIGSERIAL PRIMARY KEY,
  observation_key TEXT NOT NULL UNIQUE,
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  raw_label TEXT NULL,
  observed_in_kind TEXT NOT NULL,
  bucket_document_id BIGINT NULL REFERENCES casework.bucket_document(id) ON DELETE RESTRICT,
  document_id BIGINT NULL REFERENCES casework.document(id) ON DELETE RESTRICT,
  file_binary_id BIGINT NULL REFERENCES casework.file_binary(id) ON DELETE RESTRICT,
  document_representation_id BIGINT NULL REFERENCES casework.document_representation(id) ON DELETE RESTRICT,
  document_segment_id BIGINT NULL REFERENCES casework.document_segment(id) ON DELETE RESTRICT,
  page_no INTEGER NULL,
  char_start INTEGER NULL,
  char_end INTEGER NULL,
  context_text TEXT NULL,
  observer_key TEXT NOT NULL,
  observer_version TEXT NOT NULL,
  namespace_hint TEXT NULL,
  role_hint TEXT NULL,
  target_candidates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT NULL,
  review_state TEXT NOT NULL DEFAULT 'unreviewed',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(raw_value) <> ''),
  CHECK (BTRIM(normalized_value) <> ''),
  CHECK (BTRIM(observer_key) <> ''),
  CHECK (BTRIM(observer_version) <> ''),
  CHECK (observed_in_kind IN ('source_record', 'metadata_row', 'representation', 'segment')),
  CHECK (num_nonnulls(bucket_document_id, document_id, file_binary_id,
    document_representation_id, document_segment_id) >= 1),
  CHECK (page_no IS NULL OR page_no >= 1),
  CHECK (char_start IS NULL OR char_start >= 0),
  CHECK (char_end IS NULL OR char_end >= 0),
  CHECK (char_start IS NULL OR char_end IS NULL OR char_end >= char_start),
  CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low')),
  CHECK (review_state IN ('unreviewed', 'needs_review', 'reviewed')),
  CHECK (jsonb_typeof(target_candidates_json) = 'array')
);

CREATE INDEX IF NOT EXISTS ix_reference_observation_normalized_value
ON casework.reference_observation(normalized_value);
CREATE INDEX IF NOT EXISTS ix_reference_observation_bucket_document_id
ON casework.reference_observation(bucket_document_id);
CREATE INDEX IF NOT EXISTS ix_reference_observation_document_id
ON casework.reference_observation(document_id);
CREATE INDEX IF NOT EXISTS ix_reference_observation_file_binary_id
ON casework.reference_observation(file_binary_id);
CREATE INDEX IF NOT EXISTS ix_reference_observation_representation_id
ON casework.reference_observation(document_representation_id);
CREATE INDEX IF NOT EXISTS ix_reference_observation_segment_id
ON casework.reference_observation(document_segment_id);

CREATE TABLE IF NOT EXISTS casework.document_representation_selection (
  id BIGSERIAL PRIMARY KEY,
  file_binary_id BIGINT NOT NULL,
  selection_purpose TEXT NOT NULL,
  selected_representation_id BIGINT NOT NULL,
  selected_by TEXT NULL,
  selection_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_representation_selection_file_binary_id_fkey
    FOREIGN KEY (file_binary_id)
    REFERENCES casework.file_binary(id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_selection_same_binary_fkey
    FOREIGN KEY (selected_representation_id, file_binary_id)
    REFERENCES casework.document_representation(id, file_binary_id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_selection_purpose_not_blank_check
    CHECK (BTRIM(selection_purpose) <> ''),
  CONSTRAINT document_representation_selection_file_binary_purpose_key
    UNIQUE (file_binary_id, selection_purpose)
);

CREATE TABLE IF NOT EXISTS casework.document_representation_comparison (
  id BIGSERIAL PRIMARY KEY,
  file_binary_id BIGINT NOT NULL,
  representation_a_id BIGINT NOT NULL,
  representation_b_id BIGINT NOT NULL,
  comparison_kind TEXT NOT NULL,
  comparator_key TEXT NOT NULL,
  comparator_version TEXT NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_representation_comparison_file_binary_id_fkey
    FOREIGN KEY (file_binary_id)
    REFERENCES casework.file_binary(id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_comparison_rep_a_same_bin_fkey
    FOREIGN KEY (representation_a_id, file_binary_id)
    REFERENCES casework.document_representation(id, file_binary_id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_comparison_rep_b_same_bin_fkey
    FOREIGN KEY (representation_b_id, file_binary_id)
    REFERENCES casework.document_representation(id, file_binary_id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_comparison_order_check
    CHECK (representation_a_id < representation_b_id),
  CONSTRAINT document_representation_comparison_kind_not_blank_check
    CHECK (BTRIM(comparison_kind) <> ''),
  CONSTRAINT document_representation_comparison_cmp_key_not_blank_check
    CHECK (BTRIM(comparator_key) <> ''),
  CONSTRAINT document_representation_comparison_cmp_ver_not_blank_check
    CHECK (BTRIM(comparator_version) <> ''),
  CONSTRAINT document_representation_comparison_identity_key
    UNIQUE (
      file_binary_id,
      comparison_kind,
      comparator_key,
      comparator_version,
      representation_a_id,
      representation_b_id
    )
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

CREATE TABLE IF NOT EXISTS casework.source_observation (
  id BIGSERIAL PRIMARY KEY,
  source_capture_id BIGINT NOT NULL REFERENCES casework.source_capture(id),
  observation_kind TEXT NOT NULL,
  observation_key TEXT NOT NULL,
  source_native_id TEXT NULL,
  parent_source_native_id TEXT NULL,
  source_path TEXT NOT NULL,
  display_title TEXT NULL,
  display_status TEXT NULL,
  display_date TEXT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_capture_id, observation_kind, observation_key),
  CHECK (observation_kind IN ('case_row', 'bucket_row', 'document_occurrence_group', 'package_artifact'))
);

CREATE TABLE IF NOT EXISTS casework.source_observation_link (
  id BIGSERIAL PRIMARY KEY,
  source_observation_id BIGINT NOT NULL REFERENCES casework.source_observation(id),
  case_file_id BIGINT NULL REFERENCES casework.case_file(id),
  bucket_id BIGINT NULL REFERENCES casework.bucket(id),
  document_id BIGINT NULL REFERENCES casework.document(id),
  mapper_key TEXT NOT NULL,
  mapper_version TEXT NOT NULL,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(case_file_id, bucket_id, document_id) = 1)
);

CREATE TABLE IF NOT EXISTS casework.case_workspace_document (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL REFERENCES casework.case_workspace(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES casework.document(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT case_workspace_document_id_case_workspace_id_key
    UNIQUE (id, case_workspace_id),
  UNIQUE (case_workspace_id, document_id)
);

CREATE TABLE IF NOT EXISTS casework.document_origin (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_document_id BIGINT NOT NULL REFERENCES casework.case_workspace_document(id) ON DELETE CASCADE,
  origin_kind TEXT NOT NULL,
  origin_reference TEXT NULL,
  origin_label TEXT NULL,
  origin_at TIMESTAMPTZ NULL,
  actor_name TEXT NULL,
  created_by TEXT NULL,
  note_text TEXT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (origin_kind IN ('manual_received', 'manual_uploaded', 'user_authored'))
);

CREATE TABLE IF NOT EXISTS casework.work_group (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL REFERENCES casework.case_workspace(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NULL,
  archived_at TIMESTAMPTZ NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT work_group_id_case_workspace_id_key
    UNIQUE (id, case_workspace_id),
  CONSTRAINT work_group_title_not_blank_check
    CHECK (BTRIM(title) <> '')
);

CREATE TABLE IF NOT EXISTS casework.work_group_document (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL REFERENCES casework.case_workspace(id) ON DELETE CASCADE,
  work_group_id BIGINT NOT NULL,
  case_workspace_document_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT work_group_document_membership_key
    UNIQUE (work_group_id, case_workspace_document_id),
  FOREIGN KEY (work_group_id, case_workspace_id)
    REFERENCES casework.work_group(id, case_workspace_id)
    ON DELETE CASCADE,
  FOREIGN KEY (case_workspace_document_id, case_workspace_id)
    REFERENCES casework.case_workspace_document(id, case_workspace_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS casework.consultation_note (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL REFERENCES casework.case_workspace(id) ON DELETE RESTRICT,
  work_group_id BIGINT NULL,
  case_file_id BIGINT NULL,
  case_workspace_document_id BIGINT NULL,
  note_kind TEXT NOT NULL,
  note_text TEXT NOT NULL,
  author_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(case_file_id, case_workspace_document_id) <= 1),
  FOREIGN KEY (work_group_id, case_workspace_id)
    REFERENCES casework.work_group(id, case_workspace_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (case_file_id, case_workspace_id)
    REFERENCES casework.case_file(id, case_workspace_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (case_workspace_document_id, case_workspace_id)
    REFERENCES casework.case_workspace_document(id, case_workspace_id)
    ON DELETE RESTRICT
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
CREATE UNIQUE INDEX IF NOT EXISTS ux_source_capture_external_identity ON casework.source_capture(capture_kind, source_system, capture_key) WHERE capture_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_source_capture_source_system ON casework.source_capture(source_system);
CREATE INDEX IF NOT EXISTS ix_source_capture_captured_at ON casework.source_capture(captured_at);
CREATE INDEX IF NOT EXISTS ix_source_capture_capture_kind ON casework.source_capture(capture_kind);
CREATE UNIQUE INDEX IF NOT EXISTS ux_import_batch_source_capture_id ON casework.import_batch(source_capture_id) WHERE source_capture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_case_workspace_primary_country_id ON casework.case_workspace(primary_country_id);
CREATE INDEX IF NOT EXISTS ix_case_workspace_lifecycle_status ON casework.case_workspace(lifecycle_status);
CREATE INDEX IF NOT EXISTS ix_case_file_case_workspace_id ON casework.case_file(case_workspace_id);
CREATE INDEX IF NOT EXISTS ix_case_workspace_reference_case_workspace_id ON casework.case_workspace_reference(case_workspace_id);
CREATE INDEX IF NOT EXISTS ix_case_workspace_reference_country_id ON casework.case_workspace_reference(country_id);
CREATE INDEX IF NOT EXISTS ix_case_workspace_reference_reference_kind ON casework.case_workspace_reference(reference_kind);
CREATE UNIQUE INDEX IF NOT EXISTS ux_case_workspace_reference_identity ON casework.case_workspace_reference (
  case_workspace_id,
  reference_kind,
  COALESCE(country_id, ''),
  COALESCE(court_name, ''),
  reference_value
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_case_workspace_reference_primary ON casework.case_workspace_reference(case_workspace_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS ix_case_workspace_document_document_id ON casework.case_workspace_document(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_document_binary_primary_per_document ON casework.document_binary(document_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS ix_document_origin_case_workspace_document_id ON casework.document_origin(case_workspace_document_id);
CREATE INDEX IF NOT EXISTS ix_document_origin_origin_kind ON casework.document_origin(origin_kind);
CREATE INDEX IF NOT EXISTS ix_document_origin_origin_at ON casework.document_origin(origin_at);
CREATE INDEX IF NOT EXISTS ix_work_group_case_workspace_id ON casework.work_group(case_workspace_id);
CREATE INDEX IF NOT EXISTS ix_work_group_archived_at ON casework.work_group(archived_at);
CREATE INDEX IF NOT EXISTS ix_work_group_document_case_workspace_id ON casework.work_group_document(case_workspace_id);
CREATE INDEX IF NOT EXISTS ix_work_group_document_case_workspace_document_id ON casework.work_group_document(case_workspace_document_id);
CREATE INDEX IF NOT EXISTS ix_processing_job_status ON casework.processing_job(status);
CREATE INDEX IF NOT EXISTS ix_processing_job_stage_key ON casework.processing_job(stage_key);
CREATE INDEX IF NOT EXISTS ix_processing_job_claimable ON casework.processing_job(requested_at, id) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS ix_processing_job_file_binary_id ON casework.processing_job(file_binary_id);
CREATE INDEX IF NOT EXISTS ix_processing_job_document_representation_id ON casework.processing_job(document_representation_id);
CREATE INDEX IF NOT EXISTS ix_processing_job_depends_on_job_id ON casework.processing_job(depends_on_job_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_processing_job_active_file_binary ON casework.processing_job(file_binary_id, stage_key, processor_key, processor_version) WHERE file_binary_id IS NOT NULL AND status IN ('queued', 'running');
CREATE UNIQUE INDEX IF NOT EXISTS ux_processing_job_active_representation ON casework.processing_job(document_representation_id, stage_key, processor_key, processor_version) WHERE document_representation_id IS NOT NULL AND status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS ix_document_representation_file_binary_id ON casework.document_representation(file_binary_id);
CREATE INDEX IF NOT EXISTS ix_document_representation_format_family ON casework.document_representation(format_family);
CREATE INDEX IF NOT EXISTS ix_document_representation_processor ON casework.document_representation(processor_key, processor_version);
CREATE INDEX IF NOT EXISTS ix_document_representation_produced_by_job_id ON casework.document_representation(produced_by_job_id);
CREATE INDEX IF NOT EXISTS ix_document_representation_source_kind ON casework.document_representation(representation_source_kind);
CREATE INDEX IF NOT EXISTS ix_document_representation_based_on_representation_id ON casework.document_representation(based_on_representation_id);
CREATE INDEX IF NOT EXISTS ix_document_segment_representation_id ON casework.document_segment(document_representation_id);
CREATE INDEX IF NOT EXISTS ix_document_segment_page_no ON casework.document_segment(page_no);
CREATE INDEX IF NOT EXISTS ix_document_representation_selection_selected_representation_id ON casework.document_representation_selection(selected_representation_id);
CREATE INDEX IF NOT EXISTS ix_document_representation_selection_selection_purpose ON casework.document_representation_selection(selection_purpose);
CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_file_binary_id ON casework.document_representation_comparison(file_binary_id);
CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_representation_a_id ON casework.document_representation_comparison(representation_a_id);
CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_representation_b_id ON casework.document_representation_comparison(representation_b_id);
CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_kind ON casework.document_representation_comparison(comparison_kind);
CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_comparator ON casework.document_representation_comparison(comparator_key, comparator_version);
CREATE INDEX IF NOT EXISTS ix_document_document_procinfo ON casework.document(document_procinfo);
CREATE INDEX IF NOT EXISTS ix_document_document_date ON casework.document(document_date);
CREATE INDEX IF NOT EXISTS ix_document_binary_file_binary_id ON casework.document_binary(file_binary_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_source_capture_id ON casework.source_observation(source_capture_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_observation_kind ON casework.source_observation(observation_kind);
CREATE INDEX IF NOT EXISTS ix_source_observation_source_path ON casework.source_observation(source_path);
CREATE INDEX IF NOT EXISTS ix_source_observation_source_native_id ON casework.source_observation(source_native_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_parent_source_native_id ON casework.source_observation(parent_source_native_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_link_source_observation_id ON casework.source_observation_link(source_observation_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_link_case_file_id ON casework.source_observation_link(case_file_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_link_bucket_id ON casework.source_observation_link(bucket_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_link_document_id ON casework.source_observation_link(document_id);
CREATE INDEX IF NOT EXISTS ix_source_observation_link_mapper_key ON casework.source_observation_link(mapper_key);
CREATE UNIQUE INDEX IF NOT EXISTS ux_source_observation_link_case_file ON casework.source_observation_link(source_observation_id, case_file_id) WHERE case_file_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_source_observation_link_bucket ON casework.source_observation_link(source_observation_id, bucket_id) WHERE bucket_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_source_observation_link_document ON casework.source_observation_link(source_observation_id, document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_consultation_note_case_workspace_id ON casework.consultation_note(case_workspace_id);
CREATE INDEX IF NOT EXISTS ix_consultation_note_work_group_id ON casework.consultation_note(work_group_id);
CREATE INDEX IF NOT EXISTS ix_consultation_note_case_file_id ON casework.consultation_note(case_file_id);
CREATE INDEX IF NOT EXISTS ix_consultation_note_case_workspace_document_id ON casework.consultation_note(case_workspace_document_id);
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

