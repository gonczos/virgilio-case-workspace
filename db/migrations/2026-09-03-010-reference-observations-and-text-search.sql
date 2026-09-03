ALTER TABLE casework.document_segment
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('portuguese', COALESCE(text_content, ''))) STORED;

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
  CONSTRAINT reference_observation_raw_value_not_blank_check CHECK (BTRIM(raw_value) <> ''),
  CONSTRAINT reference_observation_normalized_value_not_blank_check CHECK (BTRIM(normalized_value) <> ''),
  CONSTRAINT reference_observation_observer_key_not_blank_check CHECK (BTRIM(observer_key) <> ''),
  CONSTRAINT reference_observation_observer_version_not_blank_check CHECK (BTRIM(observer_version) <> ''),
  CONSTRAINT reference_observation_observed_in_kind_check CHECK (
    observed_in_kind IN ('source_record', 'metadata_row', 'representation', 'segment')
  ),
  CONSTRAINT reference_observation_anchor_check CHECK (
    num_nonnulls(bucket_document_id, document_id, file_binary_id,
      document_representation_id, document_segment_id) >= 1
  ),
  CONSTRAINT reference_observation_page_no_check CHECK (page_no IS NULL OR page_no >= 1),
  CONSTRAINT reference_observation_char_start_check CHECK (char_start IS NULL OR char_start >= 0),
  CONSTRAINT reference_observation_char_end_check CHECK (char_end IS NULL OR char_end >= 0),
  CONSTRAINT reference_observation_char_order_check CHECK (
    char_start IS NULL OR char_end IS NULL OR char_end >= char_start
  ),
  CONSTRAINT reference_observation_confidence_check CHECK (
    confidence IS NULL OR confidence IN ('high', 'medium', 'low')
  ),
  CONSTRAINT reference_observation_review_state_check CHECK (
    review_state IN ('unreviewed', 'needs_review', 'reviewed')
  ),
  CONSTRAINT reference_observation_target_candidates_array_check CHECK (
    jsonb_typeof(target_candidates_json) = 'array'
  )
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
