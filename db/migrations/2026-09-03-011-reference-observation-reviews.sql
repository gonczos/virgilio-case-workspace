CREATE TABLE IF NOT EXISTS casework.reference_observation_review (
  reference_observation_id BIGINT PRIMARY KEY
    REFERENCES casework.reference_observation(id) ON DELETE RESTRICT,
  namespace_hint TEXT NULL,
  role_hint TEXT NULL,
  target_candidates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT NULL,
  review_state TEXT NOT NULL,
  review_note TEXT NULL,
  reviewer_key TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reference_observation_review_reviewer_not_blank_check
    CHECK (BTRIM(reviewer_key) <> ''),
  CONSTRAINT reference_observation_review_confidence_check
    CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low')),
  CONSTRAINT reference_observation_review_state_check
    CHECK (review_state IN ('needs_review', 'reviewed')),
  CONSTRAINT reference_observation_review_targets_array_check
    CHECK (jsonb_typeof(target_candidates_json) = 'array')
);
