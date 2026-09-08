# Consultation V1 Release Inputs

This directory contains the versioned, secret-free release inputs for
Consultation V1. The corresponding V1.2/V1.3 deployment package is under
`deploy/consultation-v1/`.

## Contracts

`contracts/openapi-v1.yaml` defines the `/api/v1` HTTP interface.
`contracts/mcp-v1.json` defines the `/mcp/v1` application contract.
`contracts/golden-v1.json` records representative success and error payloads
from the frozen corpus.

Regenerate the golden fixture from a read-only database session:

```powershell
npm run release:v1:contracts
```

## Baseline

The baseline inventories are generated from the source package, the
representation artifacts referenced by PostgreSQL, the schema files, the
contract files, fixed database assertions, and a supplied PostgreSQL custom
format snapshot.

The snapshot is deliberately excluded from Git. The V1.1 snapshot contains
only the `casework` schema; temporary review and administration schemas are not
release data.

```powershell
npm run release:v1:inventory -- --database-snapshot data/releases/consultation-v1/consultation-v1-input.dump
npm run release:v1:verify -- --database-snapshot data/releases/consultation-v1/consultation-v1-input.dump
```

Generation and verification perform database reads inside a repeatable-read,
read-only transaction. The inventory command does not create or modify corpus
rows.
