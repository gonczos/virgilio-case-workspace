ALTER TABLE casework.document_representation
ADD COLUMN IF NOT EXISTS representation_source_kind TEXT NOT NULL DEFAULT 'machine_generated';

ALTER TABLE casework.document_representation
ADD COLUMN IF NOT EXISTS representation_variant_key TEXT NOT NULL DEFAULT '';

ALTER TABLE casework.document_representation
ADD COLUMN IF NOT EXISTS based_on_representation_id BIGINT NULL;

ALTER TABLE casework.document_representation
DROP CONSTRAINT IF EXISTS document_representation_output_identity_key;

ALTER TABLE casework.document_representation
ADD CONSTRAINT document_representation_output_identity_key
UNIQUE (
  file_binary_id,
  representation_kind,
  processor_key,
  processor_version,
  representation_variant_key
);

ALTER TABLE casework.document_representation
ADD CONSTRAINT document_representation_source_kind_check
CHECK (representation_source_kind IN ('machine_generated', 'human_authored'));

ALTER TABLE casework.document_representation
ADD CONSTRAINT document_representation_variant_key_not_blank_check
CHECK (representation_variant_key = '' OR BTRIM(representation_variant_key) <> '');

ALTER TABLE casework.document_representation
ADD CONSTRAINT document_representation_based_on_representation_id_fkey
FOREIGN KEY (based_on_representation_id)
REFERENCES casework.document_representation(id)
ON DELETE RESTRICT;

ALTER TABLE casework.document_representation
ADD CONSTRAINT document_representation_id_file_binary_id_key
UNIQUE (id, file_binary_id);

CREATE TABLE IF NOT EXISTS casework.document_representation_selection (
  id BIGSERIAL PRIMARY KEY,
  file_binary_id BIGINT NOT NULL,
  selection_purpose TEXT NOT NULL,
  selected_representation_id BIGINT NOT NULL,
  selected_by TEXT NULL,
  selection_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_representation_selection_file_binary_id_fkey
    FOREIGN KEY (file_binary_id)
    REFERENCES casework.file_binary(id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_selection_same_binary_fkey
    FOREIGN KEY (selected_representation_id, file_binary_id)
    REFERENCES casework.document_representation(id, file_binary_id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_selection_purpose_not_blank_check
    CHECK (BTRIM(selection_purpose) <> ''),
  CONSTRAINT document_representation_selection_file_binary_purpose_key
    UNIQUE (file_binary_id, selection_purpose)
);

CREATE TABLE IF NOT EXISTS casework.document_representation_comparison (
  id BIGSERIAL PRIMARY KEY,
  file_binary_id BIGINT NOT NULL,
  representation_a_id BIGINT NOT NULL,
  representation_b_id BIGINT NOT NULL,
  comparison_kind TEXT NOT NULL,
  comparator_key TEXT NOT NULL,
  comparator_version TEXT NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_representation_comparison_file_binary_id_fkey
    FOREIGN KEY (file_binary_id)
    REFERENCES casework.file_binary(id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_comparison_rep_a_same_bin_fkey
    FOREIGN KEY (representation_a_id, file_binary_id)
    REFERENCES casework.document_representation(id, file_binary_id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_comparison_rep_b_same_bin_fkey
    FOREIGN KEY (representation_b_id, file_binary_id)
    REFERENCES casework.document_representation(id, file_binary_id)
    ON DELETE RESTRICT,
  CONSTRAINT document_representation_comparison_order_check
    CHECK (representation_a_id < representation_b_id),
  CONSTRAINT document_representation_comparison_kind_not_blank_check
    CHECK (BTRIM(comparison_kind) <> ''),
  CONSTRAINT document_representation_comparison_cmp_key_not_blank_check
    CHECK (BTRIM(comparator_key) <> ''),
  CONSTRAINT document_representation_comparison_cmp_ver_not_blank_check
    CHECK (BTRIM(comparator_version) <> ''),
  CONSTRAINT document_representation_comparison_identity_key
    UNIQUE (
      file_binary_id,
      comparison_kind,
      comparator_key,
      comparator_version,
      representation_a_id,
      representation_b_id
    )
);

CREATE INDEX IF NOT EXISTS ix_document_representation_source_kind
ON casework.document_representation(representation_source_kind);

CREATE INDEX IF NOT EXISTS ix_document_representation_based_on_representation_id
ON casework.document_representation(based_on_representation_id);

CREATE INDEX IF NOT EXISTS ix_document_representation_selection_selected_representation_id
ON casework.document_representation_selection(selected_representation_id);

CREATE INDEX IF NOT EXISTS ix_document_representation_selection_selection_purpose
ON casework.document_representation_selection(selection_purpose);

CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_file_binary_id
ON casework.document_representation_comparison(file_binary_id);

CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_representation_a_id
ON casework.document_representation_comparison(representation_a_id);

CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_representation_b_id
ON casework.document_representation_comparison(representation_b_id);

CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_kind
ON casework.document_representation_comparison(comparison_kind);

CREATE INDEX IF NOT EXISTS ix_document_representation_comparison_comparator
ON casework.document_representation_comparison(comparator_key, comparator_version);
