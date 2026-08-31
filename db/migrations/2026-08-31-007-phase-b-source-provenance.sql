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
  CONSTRAINT source_capture_capture_kind_check
    CHECK (capture_kind IN ('portable_package_export', 'live_scrape_snapshot', 'manual_source_capture'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_source_capture_external_identity
ON casework.source_capture (capture_kind, source_system, capture_key)
WHERE capture_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_source_capture_source_system
ON casework.source_capture(source_system);

CREATE INDEX IF NOT EXISTS ix_source_capture_captured_at
ON casework.source_capture(captured_at);

CREATE INDEX IF NOT EXISTS ix_source_capture_capture_kind
ON casework.source_capture(capture_kind);

ALTER TABLE casework.import_batch
ADD COLUMN IF NOT EXISTS source_capture_id BIGINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'import_batch_source_capture_id_fkey'
      AND conrelid = 'casework.import_batch'::regclass
  ) THEN
    ALTER TABLE casework.import_batch
    ADD CONSTRAINT import_batch_source_capture_id_fkey
    FOREIGN KEY (source_capture_id)
    REFERENCES casework.source_capture(id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_import_batch_source_capture_id
ON casework.import_batch(source_capture_id)
WHERE source_capture_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS casework.source_observation (
  id BIGSERIAL PRIMARY KEY,
  source_capture_id BIGINT NOT NULL,
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
  CONSTRAINT source_observation_source_capture_id_fkey
    FOREIGN KEY (source_capture_id)
    REFERENCES casework.source_capture(id),
  CONSTRAINT source_observation_kind_check
    CHECK (observation_kind IN ('case_row', 'bucket_row', 'document_occurrence_group', 'package_artifact')),
  CONSTRAINT source_observation_capture_kind_key
    UNIQUE (source_capture_id, observation_kind, observation_key)
);

CREATE INDEX IF NOT EXISTS ix_source_observation_source_capture_id
ON casework.source_observation(source_capture_id);

CREATE INDEX IF NOT EXISTS ix_source_observation_observation_kind
ON casework.source_observation(observation_kind);

CREATE INDEX IF NOT EXISTS ix_source_observation_source_path
ON casework.source_observation(source_path);

CREATE INDEX IF NOT EXISTS ix_source_observation_source_native_id
ON casework.source_observation(source_native_id);

CREATE INDEX IF NOT EXISTS ix_source_observation_parent_source_native_id
ON casework.source_observation(parent_source_native_id);

CREATE TABLE IF NOT EXISTS casework.source_observation_link (
  id BIGSERIAL PRIMARY KEY,
  source_observation_id BIGINT NOT NULL,
  case_file_id BIGINT NULL,
  bucket_id BIGINT NULL,
  document_id BIGINT NULL,
  mapper_key TEXT NOT NULL,
  mapper_version TEXT NOT NULL,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_observation_link_source_observation_id_fkey
    FOREIGN KEY (source_observation_id)
    REFERENCES casework.source_observation(id),
  CONSTRAINT source_observation_link_case_file_id_fkey
    FOREIGN KEY (case_file_id)
    REFERENCES casework.case_file(id),
  CONSTRAINT source_observation_link_bucket_id_fkey
    FOREIGN KEY (bucket_id)
    REFERENCES casework.bucket(id),
  CONSTRAINT source_observation_link_document_id_fkey
    FOREIGN KEY (document_id)
    REFERENCES casework.document(id),
  CONSTRAINT source_observation_link_exactly_one_target_check
    CHECK (num_nonnulls(case_file_id, bucket_id, document_id) = 1)
);

CREATE INDEX IF NOT EXISTS ix_source_observation_link_source_observation_id
ON casework.source_observation_link(source_observation_id);

CREATE INDEX IF NOT EXISTS ix_source_observation_link_case_file_id
ON casework.source_observation_link(case_file_id);

CREATE INDEX IF NOT EXISTS ix_source_observation_link_bucket_id
ON casework.source_observation_link(bucket_id);

CREATE INDEX IF NOT EXISTS ix_source_observation_link_document_id
ON casework.source_observation_link(document_id);

CREATE INDEX IF NOT EXISTS ix_source_observation_link_mapper_key
ON casework.source_observation_link(mapper_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_source_observation_link_case_file
ON casework.source_observation_link(source_observation_id, case_file_id)
WHERE case_file_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_source_observation_link_bucket
ON casework.source_observation_link(source_observation_id, bucket_id)
WHERE bucket_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_source_observation_link_document
ON casework.source_observation_link(source_observation_id, document_id)
WHERE document_id IS NOT NULL;
