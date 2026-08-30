CREATE TABLE IF NOT EXISTS casework.case_workspace (
  id BIGSERIAL PRIMARY KEY,
  workspace_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NULL,
  lifecycle_status TEXT NOT NULL,
  primary_country_id CHAR(2) NULL REFERENCES casework.country(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (lifecycle_status IN ('prospective', 'preparing', 'filed', 'active', 'closed', 'archived'))
);

ALTER TABLE casework.case_file
ADD COLUMN IF NOT EXISTS case_workspace_id BIGINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'case_file_case_workspace_id_fkey'
      AND conrelid = 'casework.case_file'::regclass
  ) THEN
    ALTER TABLE casework.case_file
    ADD CONSTRAINT case_file_case_workspace_id_fkey
    FOREIGN KEY (case_workspace_id) REFERENCES casework.case_workspace(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_case_workspace_primary_country_id
ON casework.case_workspace(primary_country_id);

CREATE INDEX IF NOT EXISTS ix_case_workspace_lifecycle_status
ON casework.case_workspace(lifecycle_status);

CREATE INDEX IF NOT EXISTS ix_case_file_case_workspace_id
ON casework.case_file(case_workspace_id);

DO $$
DECLARE
  orphan_count INTEGER;
  cycle_or_unrooted_count INTEGER;
  ambiguous_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO orphan_count
  FROM casework.case_file AS child
  LEFT JOIN casework.case_file AS parent
    ON parent.id = child.parent_case_file_id
  WHERE child.parent_case_file_id IS NOT NULL
    AND parent.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'case_file graph contains % orphaned parent reference(s)', orphan_count;
  END IF;

  WITH RECURSIVE root_tree AS (
    SELECT
      root.id AS root_id,
      root.id AS case_file_id,
      ARRAY[root.id] AS path
    FROM casework.case_file AS root
    WHERE root.parent_case_file_id IS NULL

    UNION ALL

    SELECT
      root_tree.root_id,
      child.id AS case_file_id,
      root_tree.path || child.id
    FROM root_tree
    JOIN casework.case_file AS child
      ON child.parent_case_file_id = root_tree.case_file_id
    WHERE NOT child.id = ANY(root_tree.path)
  ),
  root_resolution AS (
    SELECT
      case_file_id,
      COUNT(DISTINCT root_id) AS root_count
    FROM root_tree
    GROUP BY case_file_id
  )
  SELECT COUNT(*)
  INTO cycle_or_unrooted_count
  FROM casework.case_file AS cf
  LEFT JOIN root_resolution AS rr
    ON rr.case_file_id = cf.id
  WHERE rr.case_file_id IS NULL;

  IF cycle_or_unrooted_count > 0 THEN
    RAISE EXCEPTION 'case_file graph contains % cycle/unrooted node(s)', cycle_or_unrooted_count;
  END IF;

  WITH RECURSIVE root_tree AS (
    SELECT
      root.id AS root_id,
      root.id AS case_file_id,
      ARRAY[root.id] AS path
    FROM casework.case_file AS root
    WHERE root.parent_case_file_id IS NULL

    UNION ALL

    SELECT
      root_tree.root_id,
      child.id AS case_file_id,
      root_tree.path || child.id
    FROM root_tree
    JOIN casework.case_file AS child
      ON child.parent_case_file_id = root_tree.case_file_id
    WHERE NOT child.id = ANY(root_tree.path)
  ),
  root_resolution AS (
    SELECT
      case_file_id,
      COUNT(DISTINCT root_id) AS root_count
    FROM root_tree
    GROUP BY case_file_id
  )
  SELECT COUNT(*)
  INTO ambiguous_count
  FROM root_resolution
  WHERE root_count <> 1;

  IF ambiguous_count > 0 THEN
    RAISE EXCEPTION 'case_file graph contains % ambiguously rooted node(s)', ambiguous_count;
  END IF;
END
$$;

WITH RECURSIVE root_tree AS (
  SELECT
    root.id AS root_id,
    root.id AS case_file_id,
    ARRAY[root.id] AS path
  FROM casework.case_file AS root
  WHERE root.parent_case_file_id IS NULL

  UNION ALL

  SELECT
    root_tree.root_id,
    child.id AS case_file_id,
    root_tree.path || child.id
  FROM root_tree
  JOIN casework.case_file AS child
    ON child.parent_case_file_id = root_tree.case_file_id
  WHERE NOT child.id = ANY(root_tree.path)
),
root_info AS (
  SELECT
    root.id AS root_id,
    root.source_system,
    root.processo,
    court.country_id
  FROM casework.case_file AS root
  JOIN casework.court AS court
    ON court.id = root.court_id
  WHERE root.parent_case_file_id IS NULL
)
INSERT INTO casework.case_workspace (
  workspace_code,
  title,
  description,
  lifecycle_status,
  primary_country_id
)
SELECT
  root_info.source_system || ':' || root_info.processo AS workspace_code,
  root_info.processo AS title,
  'Backfilled from imported root case_file.',
  'active',
  root_info.country_id
FROM root_info
ON CONFLICT (workspace_code) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  primary_country_id = EXCLUDED.primary_country_id,
  updated_at = NOW();

WITH RECURSIVE root_tree AS (
  SELECT
    root.id AS root_id,
    root.id AS case_file_id,
    ARRAY[root.id] AS path
  FROM casework.case_file AS root
  WHERE root.parent_case_file_id IS NULL

  UNION ALL

  SELECT
    root_tree.root_id,
    child.id AS case_file_id,
    root_tree.path || child.id
  FROM root_tree
  JOIN casework.case_file AS child
    ON child.parent_case_file_id = root_tree.case_file_id
  WHERE NOT child.id = ANY(root_tree.path)
),
workspace_map AS (
  SELECT
    root.id AS root_id,
    cw.id AS case_workspace_id
  FROM casework.case_file AS root
  JOIN casework.case_workspace AS cw
    ON cw.workspace_code = root.source_system || ':' || root.processo
  WHERE root.parent_case_file_id IS NULL
)
UPDATE casework.case_file AS cf
SET
  case_workspace_id = workspace_map.case_workspace_id,
  updated_at = NOW()
FROM root_tree
JOIN workspace_map
  ON workspace_map.root_id = root_tree.root_id
WHERE cf.id = root_tree.case_file_id
  AND cf.case_workspace_id IS DISTINCT FROM workspace_map.case_workspace_id;
