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
5. upsert buckets
6. upsert documents
7. upsert bucket-document links
8. upsert file binaries
9. upsert document-binary links
10. commit transaction

## Notes

V1 does not yet import raw artifacts or provenance files into dedicated tables.
Those stay on disk and can be integrated later.
