ALTER TABLE casework.source_capture ALTER COLUMN captured_at DROP NOT NULL;
ALTER TABLE casework.source_capture ADD COLUMN IF NOT EXISTS capture_ended_at timestamptz;
ALTER TABLE casework.source_capture ADD COLUMN IF NOT EXISTS capture_time_basis text NOT NULL DEFAULT 'legacy_unspecified'
  CHECK (capture_time_basis IN ('legacy_unspecified','unknown','source_reported','inferred_run_label'));

CREATE TABLE IF NOT EXISTS casework.import_execution (
  id bigserial PRIMARY KEY,
  source_capture_id bigint REFERENCES casework.source_capture(id) ON DELETE RESTRICT,
  import_batch_id bigint REFERENCES casework.import_batch(id) ON DELETE RESTRICT,
  execution_key text UNIQUE,
  importer_key text NOT NULL,
  importer_version text NOT NULL,
  input_sha256 text NOT NULL CHECK (input_sha256 ~ '^[a-f0-9]{64}$'),
  source_label text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','succeeded','failed','historical_completed')),
  reused_capture boolean NOT NULL DEFAULT false,
  counts_json jsonb NOT NULL DEFAULT '{}',
  error_json jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  CHECK (finished_at IS NULL OR finished_at >= started_at),
  CHECK (status NOT IN ('succeeded','failed') OR finished_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_import_execution_capture ON casework.import_execution(source_capture_id);

-- Backfill only the saved-HTML captures explicitly documenting the old misuse.
-- The old registration timestamp is historical evidence, not a scrape timestamp.
INSERT INTO casework.import_execution(source_capture_id,execution_key,importer_key,importer_version,input_sha256,
  source_label,started_at,status,counts_json,metadata_json)
SELECT s.id,'historical-html-registration:'||s.id,'citius-html-import',s.metadata_json->>'loader_sha256',
  s.metadata_json->>'snapshot_sha256',s.external_source_label,s.captured_at,'historical_completed',
  jsonb_build_object('observations',(SELECT count(*) FROM casework.source_observation o WHERE o.source_capture_id=s.id)),
  jsonb_build_object('timing_basis','Preserved former captured_at registration timestamp; exact execution start/end unknown',
    'original_capture_metadata',s.metadata_json)
FROM casework.source_capture s
WHERE s.capture_key LIKE 'saved-html:%'
  AND s.metadata_json->>'captured_at_semantics' LIKE 'Time saved artifacts were registered here%'
ON CONFLICT(execution_key) DO NOTHING;

UPDATE casework.source_capture s SET
  captured_at=NULL, capture_time_basis='unknown',
  metadata_json=s.metadata_json || jsonb_build_object(
    'legacy_registration_at',s.captured_at,
    'captured_at_semantics','Source capture start; unknown until supported by source evidence')
WHERE s.capture_key LIKE 'saved-html:%'
  AND s.metadata_json->>'captured_at_semantics' LIKE 'Time saved artifacts were registered here%';
