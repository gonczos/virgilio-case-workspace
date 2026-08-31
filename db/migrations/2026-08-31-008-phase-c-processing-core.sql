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
  CONSTRAINT document_representation_output_identity_key
    UNIQUE (file_binary_id, representation_kind, processor_key, processor_version),
  CONSTRAINT document_representation_produced_by_job_id_key
    UNIQUE (produced_by_job_id)
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

CREATE INDEX IF NOT EXISTS ix_processing_job_status
ON casework.processing_job(status);

CREATE INDEX IF NOT EXISTS ix_processing_job_stage_key
ON casework.processing_job(stage_key);

CREATE INDEX IF NOT EXISTS ix_processing_job_claimable
ON casework.processing_job(requested_at, id)
WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS ix_processing_job_file_binary_id
ON casework.processing_job(file_binary_id);

CREATE INDEX IF NOT EXISTS ix_processing_job_document_representation_id
ON casework.processing_job(document_representation_id);

CREATE INDEX IF NOT EXISTS ix_processing_job_depends_on_job_id
ON casework.processing_job(depends_on_job_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_processing_job_active_file_binary
ON casework.processing_job(file_binary_id, stage_key, processor_key, processor_version)
WHERE file_binary_id IS NOT NULL
  AND status IN ('queued', 'running');

CREATE UNIQUE INDEX IF NOT EXISTS ux_processing_job_active_representation
ON casework.processing_job(document_representation_id, stage_key, processor_key, processor_version)
WHERE document_representation_id IS NOT NULL
  AND status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS ix_document_representation_file_binary_id
ON casework.document_representation(file_binary_id);

CREATE INDEX IF NOT EXISTS ix_document_representation_format_family
ON casework.document_representation(format_family);

CREATE INDEX IF NOT EXISTS ix_document_representation_processor
ON casework.document_representation(processor_key, processor_version);

CREATE INDEX IF NOT EXISTS ix_document_representation_produced_by_job_id
ON casework.document_representation(produced_by_job_id);

CREATE INDEX IF NOT EXISTS ix_document_segment_representation_id
ON casework.document_segment(document_representation_id);

CREATE INDEX IF NOT EXISTS ix_document_segment_page_no
ON casework.document_segment(page_no);
