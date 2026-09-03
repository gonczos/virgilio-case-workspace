ALTER TABLE casework.reference_observation
ADD COLUMN IF NOT EXISTS case_file_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS bucket_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS observation_origin TEXT NULL,
ADD COLUMN IF NOT EXISTS source_field TEXT NULL,
ADD COLUMN IF NOT EXISTS identifier_type TEXT NULL,
ADD COLUMN IF NOT EXISTS source_assertion_key TEXT NULL,
ADD COLUMN IF NOT EXISTS normalization_identity TEXT NULL,
ADD COLUMN IF NOT EXISTS anchored_occurrence_date DATE NULL,
ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'current';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reference_observation_case_file_id_fkey'
      AND conrelid = 'casework.reference_observation'::regclass
  ) THEN
    ALTER TABLE casework.reference_observation
    ADD CONSTRAINT reference_observation_case_file_id_fkey
    FOREIGN KEY (case_file_id) REFERENCES casework.case_file(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reference_observation_bucket_id_fkey'
      AND conrelid = 'casework.reference_observation'::regclass
  ) THEN
    ALTER TABLE casework.reference_observation
    ADD CONSTRAINT reference_observation_bucket_id_fkey
    FOREIGN KEY (bucket_id) REFERENCES casework.bucket(id) ON DELETE RESTRICT;
  END IF;
END
$$;

ALTER TABLE casework.reference_observation
DROP CONSTRAINT IF EXISTS reference_observation_anchor_check;

ALTER TABLE casework.reference_observation
DROP CONSTRAINT IF EXISTS reference_observation_lifecycle_state_check;

ALTER TABLE casework.reference_observation
ADD CONSTRAINT reference_observation_anchor_check CHECK (
  num_nonnulls(case_file_id, bucket_id, bucket_document_id, document_id,
    file_binary_id, document_representation_id, document_segment_id) >= 1
),
ADD CONSTRAINT reference_observation_lifecycle_state_check CHECK (
  lifecycle_state IN ('current', 'superseded', 'retired_source_absent')
);

CREATE INDEX IF NOT EXISTS ix_reference_observation_case_file_id
ON casework.reference_observation(case_file_id);

CREATE INDEX IF NOT EXISTS ix_reference_observation_bucket_id
ON casework.reference_observation(bucket_id);

CREATE INDEX IF NOT EXISTS ix_reference_observation_source_assertion_key
ON casework.reference_observation(source_assertion_key);

CREATE UNIQUE INDEX IF NOT EXISTS ux_reference_observation_current_source_assertion
ON casework.reference_observation(source_assertion_key)
WHERE source_assertion_key IS NOT NULL AND lifecycle_state = 'current';

CREATE TABLE IF NOT EXISTS casework.reference_observation_lifecycle_event (
  id BIGSERIAL PRIMARY KEY,
  reference_observation_id BIGINT NOT NULL
    REFERENCES casework.reference_observation(id) ON DELETE RESTRICT,
  related_reference_observation_id BIGINT NULL
    REFERENCES casework.reference_observation(id) ON DELETE RESTRICT,
  transition_kind TEXT NOT NULL,
  from_state TEXT NULL,
  to_state TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  actor_version TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (BTRIM(transition_kind) <> ''),
  CHECK (from_state IS NULL OR from_state IN ('current', 'superseded', 'retired_source_absent')),
  CHECK (to_state IN ('current', 'superseded', 'retired_source_absent')),
  CHECK (BTRIM(actor_key) <> ''),
  CHECK (BTRIM(actor_version) <> ''),
  CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE INDEX IF NOT EXISTS ix_reference_observation_lifecycle_event_observation
ON casework.reference_observation_lifecycle_event(reference_observation_id, occurred_at, id);

CREATE INDEX IF NOT EXISTS ix_reference_observation_lifecycle_event_related
ON casework.reference_observation_lifecycle_event(related_reference_observation_id);
