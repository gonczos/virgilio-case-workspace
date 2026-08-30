# Importer V1

Last updated: 2026-08-30

## Purpose

The importer loads a settled case package from `data/imports/` into the `casework` PostgreSQL schema.

It is intentionally conservative:

- it does not scrape live systems
- it does not invent source facts
- it does not rewrite binary identity
- it upserts by alternate keys

## Runtime

The first version is a Node CLI using `pg`.

Expected environment:

- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`

Or:

- `DATABASE_URL`

## Usage

From the repository root:

```bash
npm install
npm run import:package -- data/imports/<package-dir>
```

You can also pass an absolute path to a package directory.

## Expected Inputs

Required files inside the package:

- `package.json`
- `cases/cases.jsonl`
- `cases/buckets.jsonl`
- `cases/documents.jsonl`
- `cases/bucket_documents.jsonl`
- `cases/file_binaries.jsonl`
- `cases/document_binaries.jsonl`

## Import Flow

1. validate package shape
2. register or update `import_batch`
3. upsert courts and cases
4. resolve parent-case links
5. if the PostgreSQL schema includes `case_workspace`, assign workspace membership from the explicit `parent_case_file_id` tree
6. upsert buckets
7. upsert documents
8. upsert bucket-document links
9. upsert file binaries
10. upsert document-binary links
11. commit transaction

## Notes

V1 does not yet import raw artifacts or provenance files into dedicated tables.
Those stay on disk and can be integrated later.

The workspace-assignment step is a PostgreSQL application-database concern.
It is separate from the legacy corpus extraction/package flow and only runs when the evolved PostgreSQL schema is present.


## A2a Compatibility

If the evolved PostgreSQL schema includes casework.case_workspace_document, the importer also maintains workspace-level document membership after canonical case, bucket, and document links are imported.

This is PostgreSQL-side maintenance for the normal import path. It is insert-safe and idempotent, but it is not a general reconciliation mechanism for arbitrary later case_file.case_workspace_id reassignment.

If the evolved PostgreSQL schema includes `casework.document.document_identity_class`, the importer also uses the imported-only document identity predicate for its `document` upsert. This preserves imported-package rerun idempotency after the imported document unique index becomes partial.

