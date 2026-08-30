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

CREATE TABLE IF NOT EXISTS casework.case_workspace_document (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL REFERENCES casework.case_workspace(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES casework.document(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_workspace_id, document_id)
);

CREATE INDEX IF NOT EXISTS ix_case_workspace_reference_case_workspace_id
ON casework.case_workspace_reference(case_workspace_id);

CREATE INDEX IF NOT EXISTS ix_case_workspace_reference_country_id
ON casework.case_workspace_reference(country_id);

CREATE INDEX IF NOT EXISTS ix_case_workspace_reference_reference_kind
ON casework.case_workspace_reference(reference_kind);

CREATE UNIQUE INDEX IF NOT EXISTS ux_case_workspace_reference_identity
ON casework.case_workspace_reference (
  case_workspace_id,
  reference_kind,
  COALESCE(country_id, ''),
  COALESCE(court_name, ''),
  reference_value
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_case_workspace_reference_primary
ON casework.case_workspace_reference(case_workspace_id)
WHERE is_primary;

CREATE INDEX IF NOT EXISTS ix_case_workspace_document_document_id
ON casework.case_workspace_document(document_id);

DO $$
DECLARE
  orphan_case_file_workspace_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO orphan_case_file_workspace_count
  FROM casework.case_file AS cf
  LEFT JOIN casework.case_workspace AS cw
    ON cw.id = cf.case_workspace_id
  WHERE cf.case_workspace_id IS NOT NULL
    AND cw.id IS NULL;

  IF orphan_case_file_workspace_count > 0 THEN
    RAISE EXCEPTION 'case_file contains % orphaned case_workspace_id reference(s)', orphan_case_file_workspace_count;
  END IF;
END
$$;

INSERT INTO casework.case_workspace_document (
  case_workspace_id,
  document_id
)
SELECT DISTINCT
  cf.case_workspace_id,
  bd.document_id
FROM casework.case_file AS cf
JOIN casework.bucket AS b
  ON b.case_file_id = cf.id
JOIN casework.bucket_document AS bd
  ON bd.bucket_id = b.id
WHERE cf.case_workspace_id IS NOT NULL
ON CONFLICT (case_workspace_id, document_id) DO NOTHING;
