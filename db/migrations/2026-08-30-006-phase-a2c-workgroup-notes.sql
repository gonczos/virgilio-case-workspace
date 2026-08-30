DO $$
DECLARE
  has_legacy_note_target_columns BOOLEAN;
  consultation_note_row_count BIGINT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'casework'
      AND table_name = 'consultation_note'
      AND column_name IN ('bucket_id', 'document_id', 'file_binary_id')
  )
  INTO has_legacy_note_target_columns;

  IF has_legacy_note_target_columns THEN
    SELECT COUNT(*)
    INTO consultation_note_row_count
    FROM casework.consultation_note;

    IF consultation_note_row_count > 0 THEN
      RAISE EXCEPTION
        'Phase A2c migration requires empty casework.consultation_note before dropping legacy target columns; found % row(s)',
        consultation_note_row_count;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'case_file_id_case_workspace_id_key'
      AND conrelid = 'casework.case_file'::regclass
  ) THEN
    ALTER TABLE casework.case_file
    ADD CONSTRAINT case_file_id_case_workspace_id_key
    UNIQUE (id, case_workspace_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'case_workspace_document_id_case_workspace_id_key'
      AND conrelid = 'casework.case_workspace_document'::regclass
  ) THEN
    ALTER TABLE casework.case_workspace_document
    ADD CONSTRAINT case_workspace_document_id_case_workspace_id_key
    UNIQUE (id, case_workspace_id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS casework.work_group (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  archived_at TIMESTAMPTZ NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT work_group_case_workspace_id_fkey
    FOREIGN KEY (case_workspace_id)
    REFERENCES casework.case_workspace(id)
    ON DELETE CASCADE,
  CONSTRAINT work_group_title_not_blank_check
    CHECK (BTRIM(title) <> ''),
  CONSTRAINT work_group_id_case_workspace_id_key
    UNIQUE (id, case_workspace_id)
);

CREATE INDEX IF NOT EXISTS ix_work_group_case_workspace_id
ON casework.work_group(case_workspace_id);

CREATE INDEX IF NOT EXISTS ix_work_group_archived_at
ON casework.work_group(archived_at);

CREATE TABLE IF NOT EXISTS casework.work_group_document (
  id BIGSERIAL PRIMARY KEY,
  case_workspace_id BIGINT NOT NULL,
  work_group_id BIGINT NOT NULL,
  case_workspace_document_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT work_group_document_case_workspace_id_fkey
    FOREIGN KEY (case_workspace_id)
    REFERENCES casework.case_workspace(id)
    ON DELETE CASCADE,
  CONSTRAINT work_group_document_work_group_workspace_fkey
    FOREIGN KEY (work_group_id, case_workspace_id)
    REFERENCES casework.work_group(id, case_workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT work_group_document_case_workspace_document_workspace_fkey
    FOREIGN KEY (case_workspace_document_id, case_workspace_id)
    REFERENCES casework.case_workspace_document(id, case_workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT work_group_document_membership_key
    UNIQUE (work_group_id, case_workspace_document_id)
);

CREATE INDEX IF NOT EXISTS ix_work_group_document_case_workspace_id
ON casework.work_group_document(case_workspace_id);

CREATE INDEX IF NOT EXISTS ix_work_group_document_case_workspace_document_id
ON casework.work_group_document(case_workspace_document_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_group_document_work_group_id_case_workspace_document_id_ke'
      AND conrelid = 'casework.work_group_document'::regclass
  ) THEN
    ALTER TABLE casework.work_group_document
    RENAME CONSTRAINT work_group_document_work_group_id_case_workspace_document_id_ke
    TO work_group_document_membership_key;
  END IF;
END
$$;

ALTER TABLE casework.consultation_note
ADD COLUMN IF NOT EXISTS case_workspace_id BIGINT,
ADD COLUMN IF NOT EXISTS work_group_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS case_workspace_document_id BIGINT NULL;

ALTER TABLE casework.consultation_note
DROP COLUMN IF EXISTS bucket_id,
DROP COLUMN IF EXISTS document_id,
DROP COLUMN IF EXISTS file_binary_id;

DROP INDEX IF EXISTS casework.ix_consultation_note_document_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultation_note_case_file_id_fkey'
      AND conrelid = 'casework.consultation_note'::regclass
  ) THEN
    ALTER TABLE casework.consultation_note
    DROP CONSTRAINT consultation_note_case_file_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultation_note_case_workspace_id_fkey'
      AND conrelid = 'casework.consultation_note'::regclass
  ) THEN
    ALTER TABLE casework.consultation_note
    DROP CONSTRAINT consultation_note_case_workspace_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultation_note_work_group_workspace_fkey'
      AND conrelid = 'casework.consultation_note'::regclass
  ) THEN
    ALTER TABLE casework.consultation_note
    DROP CONSTRAINT consultation_note_work_group_workspace_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultation_note_case_file_workspace_fkey'
      AND conrelid = 'casework.consultation_note'::regclass
  ) THEN
    ALTER TABLE casework.consultation_note
    DROP CONSTRAINT consultation_note_case_file_workspace_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultation_note_case_workspace_document_workspace_fkey'
      AND conrelid = 'casework.consultation_note'::regclass
  ) THEN
    ALTER TABLE casework.consultation_note
    DROP CONSTRAINT consultation_note_case_workspace_document_workspace_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultation_note_single_subject_check'
      AND conrelid = 'casework.consultation_note'::regclass
  ) THEN
    ALTER TABLE casework.consultation_note
    DROP CONSTRAINT consultation_note_single_subject_check;
  END IF;
END
$$;

ALTER TABLE casework.consultation_note
ALTER COLUMN case_workspace_id SET NOT NULL;

ALTER TABLE casework.consultation_note
ADD CONSTRAINT consultation_note_case_workspace_id_fkey
  FOREIGN KEY (case_workspace_id)
  REFERENCES casework.case_workspace(id)
  ON DELETE RESTRICT,
ADD CONSTRAINT consultation_note_work_group_workspace_fkey
  FOREIGN KEY (work_group_id, case_workspace_id)
  REFERENCES casework.work_group(id, case_workspace_id)
  ON DELETE RESTRICT,
ADD CONSTRAINT consultation_note_case_file_workspace_fkey
  FOREIGN KEY (case_file_id, case_workspace_id)
  REFERENCES casework.case_file(id, case_workspace_id)
  ON DELETE RESTRICT,
ADD CONSTRAINT consultation_note_case_workspace_document_workspace_fkey
  FOREIGN KEY (case_workspace_document_id, case_workspace_id)
  REFERENCES casework.case_workspace_document(id, case_workspace_id)
  ON DELETE RESTRICT,
ADD CONSTRAINT consultation_note_single_subject_check
  CHECK (num_nonnulls(case_file_id, case_workspace_document_id) <= 1);

CREATE INDEX IF NOT EXISTS ix_consultation_note_case_workspace_id
ON casework.consultation_note(case_workspace_id);

CREATE INDEX IF NOT EXISTS ix_consultation_note_work_group_id
ON casework.consultation_note(work_group_id);

CREATE INDEX IF NOT EXISTS ix_consultation_note_case_file_id
ON casework.consultation_note(case_file_id);

CREATE INDEX IF NOT EXISTS ix_consultation_note_case_workspace_document_id
ON casework.consultation_note(case_workspace_document_id);
