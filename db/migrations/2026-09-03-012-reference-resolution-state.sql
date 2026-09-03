ALTER TABLE casework.reference_observation_review
ADD COLUMN IF NOT EXISTS resolution_state TEXT NOT NULL DEFAULT 'unresolved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reference_observation_review_resolution_state_check'
      AND conrelid = 'casework.reference_observation_review'::regclass
  ) THEN
    ALTER TABLE casework.reference_observation_review
    ADD CONSTRAINT reference_observation_review_resolution_state_check
    CHECK (resolution_state IN ('unresolved', 'ambiguous', 'resolved'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reference_observation_review_resolved_target_check'
      AND conrelid = 'casework.reference_observation_review'::regclass
  ) THEN
    ALTER TABLE casework.reference_observation_review
    ADD CONSTRAINT reference_observation_review_resolved_target_check
    CHECK (resolution_state <> 'resolved' OR jsonb_array_length(target_candidates_json) = 1);
  END IF;
END $$;
