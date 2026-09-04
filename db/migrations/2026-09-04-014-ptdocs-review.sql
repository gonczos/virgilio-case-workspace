-- Isolated, append-only external enrichment review; no canonical data migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ptdocs_reviewer') THEN
    CREATE ROLE ptdocs_reviewer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ptdocs_reviewer'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolcanlogin OR rolbypassrls))
     OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='ptdocs_reviewer')) THEN
    RAISE EXCEPTION 'Existing ptdocs_reviewer role is not isolated';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS ptdocs_review;
REVOKE ALL ON SCHEMA ptdocs_review FROM PUBLIC;
GRANT USAGE ON SCHEMA casework, ptdocs_review TO ptdocs_reviewer;
GRANT SELECT ON ALL TABLES IN SCHEMA casework TO ptdocs_reviewer;

CREATE TABLE IF NOT EXISTS ptdocs_review.import_batch (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_key text NOT NULL UNIQUE,
  attribution text NOT NULL,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ptdocs_review.source_row (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES ptdocs_review.import_batch(id),
  workbook text NOT NULL,
  workbook_sha256 text NOT NULL CHECK (workbook_sha256 ~ '^[a-f0-9]{64}$'),
  sheet text NOT NULL,
  row_number int NOT NULL CHECK (row_number>0),
  cells jsonb NOT NULL,
  UNIQUE(batch_id,workbook,sheet,row_number),
  UNIQUE(batch_id,id)
);
CREATE TABLE IF NOT EXISTS ptdocs_review.row_match (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES ptdocs_review.import_batch(id),
  source_row_id bigint NOT NULL,
  bucket_document_id bigint REFERENCES casework.bucket_document(id),
  file_binary_id bigint REFERENCES casework.file_binary(id),
  method text NOT NULL,
  evidence jsonb NOT NULL,
  FOREIGN KEY(batch_id,source_row_id) REFERENCES ptdocs_review.source_row(batch_id,id),
  UNIQUE(batch_id,source_row_id)
);
CREATE TABLE IF NOT EXISTS ptdocs_review.validation_finding (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES ptdocs_review.import_batch(id),
  source_row_id bigint,
  finding_key text NOT NULL,
  check_kind text NOT NULL,
  column_key text,
  external_value jsonb,
  assessment text NOT NULL CHECK(assessment IN ('supported','partially_supported','contradicted','unresolved','candidate','informational')),
  evidence jsonb NOT NULL,
  method text NOT NULL,
  reviewer text NOT NULL,
  proposed_value jsonb,
  supersedes_id bigint REFERENCES ptdocs_review.validation_finding(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(batch_id,source_row_id) REFERENCES ptdocs_review.source_row(batch_id,id),
  UNIQUE(batch_id,finding_key)
);
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ptdocs_review TO ptdocs_reviewer;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ptdocs_review TO ptdocs_reviewer;
COMMENT ON SCHEMA ptdocs_review IS 'External PTDocs enrichment staging and attributed validation; never canonical evidence or automatic promotion.';
