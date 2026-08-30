DO $$
DECLARE
  duplicate_identity_group_count INTEGER;
  conflicting_primary_binary_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_identity_group_count
  FROM (
    SELECT
      source_system,
      document_procinfo,
      document_name,
      document_date,
      document_type,
      claimed_size_bytes
    FROM casework.document
    GROUP BY
      source_system,
      document_procinfo,
      document_name,
      document_date,
      document_type,
      claimed_size_bytes
    HAVING COUNT(*) > 1
  ) AS duplicate_groups;

  IF duplicate_identity_group_count > 0 THEN
    RAISE EXCEPTION 'document contains % duplicate imported identity group(s)', duplicate_identity_group_count;
  END IF;

  SELECT COUNT(*)
  INTO conflicting_primary_binary_count
  FROM (
    SELECT
      document_id
    FROM casework.document_binary
    WHERE is_primary
    GROUP BY document_id
    HAVING COUNT(*) > 1
  ) AS conflicting_primary_groups;

  IF conflicting_primary_binary_count > 0 THEN
    RAISE EXCEPTION 'document_binary contains % document(s) with more than one primary binary', conflicting_primary_binary_count;
  END IF;
END
$$;

ALTER TABLE casework.document
ADD COLUMN IF NOT EXISTS document_identity_class TEXT NOT NULL DEFAULT 'imported_source_keyed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_document_identity_class_check'
      AND conrelid = 'casework.document'::regclass
  ) THEN
    ALTER TABLE casework.document
    ADD CONSTRAINT document_document_identity_class_check
    CHECK (document_identity_class IN ('imported_source_keyed', 'workspace_native'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_imported_source_system_required_check'
      AND conrelid = 'casework.document'::regclass
  ) THEN
    ALTER TABLE casework.document
    ADD CONSTRAINT document_imported_source_system_required_check
    CHECK (document_identity_class <> 'imported_source_keyed' OR source_system IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_imported_canonical_confidence_required_check'
      AND conrelid = 'casework.document'::regclass
  ) THEN
    ALTER TABLE casework.document
    ADD CONSTRAINT document_imported_canonical_confidence_required_check
    CHECK (document_identity_class <> 'imported_source_keyed' OR canonical_confidence IS NOT NULL);
  END IF;
END
$$;

ALTER TABLE casework.document
ALTER COLUMN source_system DROP NOT NULL;

ALTER TABLE casework.document
ALTER COLUMN canonical_confidence DROP NOT NULL;

DROP INDEX IF EXISTS casework.ux_document_source_identity;

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

CREATE INDEX IF NOT EXISTS ix_document_origin_case_workspace_document_id
ON casework.document_origin(case_workspace_document_id);

CREATE INDEX IF NOT EXISTS ix_document_origin_origin_kind
ON casework.document_origin(origin_kind);

CREATE INDEX IF NOT EXISTS ix_document_origin_origin_at
ON casework.document_origin(origin_at);

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_binary_primary_per_document
ON casework.document_binary(document_id)
WHERE is_primary;
