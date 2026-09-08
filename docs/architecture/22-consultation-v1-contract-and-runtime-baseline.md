# Consultation V1 Contract And Runtime Baseline

Last updated: 2026-09-08

## Status

This document records the V1.1 inventory and contract-boundary decision from
`21-consultation-v1-read-only-online-service-package.md`. It records the
observed development baseline at Git commit
`27d13f89ea6cadfd5886993ecfa8eb0cf074c5f5` and defines which existing
consultation capabilities will be promoted into Consultation v1.

V1.1 was completed on 2026-09-08 by the generated and repeatably verified
release input under `release/consultation-v1/baseline/`. It inventories the
full payload and contracts and identifies the immutable input database
snapshot. The generated manifest's source commit is
`eaa391f414f91ed08f5478f65bb9a9d6d6ea0481`. This gate incorporates the
independent plan review completed on 2026-09-08.

The recorded source commit is historical freeze provenance. Verification on a
later release commit preserves that value while recomputing and comparing the
generator, schema, contracts, database state and snapshot, source package, and
representation artifacts. It does not replace the frozen source commit with
the current release-branch HEAD.

This is a release input, not a claim that the authenticated online package has
already been implemented. V1.1 assigns the immutable input database snapshot.
The final configured release-backup hash and container-image digests are
assigned after the release candidate is built.

The machine-readable companion is
`docs/architecture/consultation-v1-baseline-manifest.json`.

## Product Boundary

Consultation v1 is the small, stable consultation product needed by an invited
case user. Its site contains:

- a paginated document/binary list;
- document detail, source context, extracted representations, and original-PDF
  access;
- full-corpus text search and court-metadata reference lookup with document
  inspection.

Text-extracted reference observations currently cover a reviewed pilot subset.
The site must describe this partial coverage rather than imply that extracted
references cover every document.

The following development capabilities are not public V1 product surfaces:

- the extraction-coverage report;
- the reference-graph and procedural-flow experiments;
- Directus;
- import, processing, indexing, review, annotation, and administration tools.

They remain available for development and may enter a later release after a
separate product and contract decision.

## Observed Corpus Baseline

The portable package is:

`tribunais-portable-case-package-13608-14-8t2snt-2026-08-30T05-26-33-368Z`

Its `package.json` SHA-256 is
`923ef1fe8df032bac9a6e26f66998c4eb80a1cea25ff4619d6a025ef0edaa827`.
The package was created at `2026-08-30T05:26:59.693Z`, uses package schema
`1.0.0`, and was imported at `2026-09-02T01:03:45.458Z`.

| Object | Package declaration | Observed database count |
| --- | ---: | ---: |
| Case workspaces | n/a | 1 |
| Case files | 5 | 5 |
| Buckets | 897 | 897 |
| Documents | 1,293 | 1,293 |
| Bucket-document occurrences | 2,070 | 2,070 |
| File binaries | 1,238 | 1,238 |
| Document-binary links | 1,257 | 1,257 |

The package contains 1,238 content-addressed binary files totaling 509,420,710
bytes. The database reports all 1,238 as `local_artifact_retained` and
`validated_by_qpdf`. The package declares 39 documents without a binary and 41
size-mismatch references; these are preserved states rather than import loss.

The saved-HTML provenance import reports complete structural coverage of the
current corpus: five cases, 897 buckets, and 2,070 document occurrences, with
no current cases, buckets, or occurrences absent from that capture. The exact
source capture time remains unknown where source evidence does not establish
it; import execution time is recorded separately.

## Observed Derived-Data Baseline

The database contains 6,210 processing jobs: 6,183 completed and 27 failed.
Failures remain historical attempts. The 6,182 stored representations cover
all 1,238 binaries and consist of:

| Representation | Processor/version | Count |
| --- | --- | ---: |
| Extracted document bundle | Docling `2.123.1-c5.2` | 1,238 |
| Extracted document bundle | Docling retry-success test variant | 1 |
| Extracted document bundle | Xberg `1.0.14-c5.2` | 1,229 |
| Literal PDF text | Poppler layout v2 C5.3.2 | 1,238 |
| PDF signature metadata | qpdf signature v1 C5.3.1 | 1,238 |
| PDF structure inventory | qpdf structure v2 C5.3.2 | 1,238 |

There are 3,706 document-text segments across 3,706 representations; 3,638
segments contain non-empty text. The Portuguese full-text GIN index is a
generated projection over `document_segment.text_content`.

There are 2,420 reference observations: 2,200 derived from source metadata, 178
from labelled representation text, 38 imported source-record observations,
and four supplied metadata rows marked as needing review. No
`reference_observation_review` row has yet been recorded. These observations
remain derived or source-attributed data and are not treated as verified legal
classification.

## Current UI Inventory And V1 Disposition

| Current route | Current purpose | V1 disposition |
| --- | --- | --- |
| `/` | Redirect to binary list | Include |
| `/binaries` | Document/binary consultation list | Include |
| `/binaries/:sha256` | Document detail and representations | Include |
| `/reference-search` | Full-corpus text/reference search | Include |
| `/reports/extraction-coverage` | Processing diagnostic | Exclude from public V1 |
| `/reference-graph/:value` | Reference-graph experiment | Exclude from public V1 |
| `/procedural-flow` | Procedural-flow experiment | Exclude from public V1 |

The current header contains a hard-coded local Directus link. The production UI
must remove it. Browser calls remain same-origin and use relative paths. The UI
must not contain a public Directus URL, local path, OAuth token, or service
credential.

## Current HTTP Inventory And V1 Disposition

All included data routes require an authenticated principal and
`consultation.read` in the release package. `GET` and `HEAD` are the only data
methods. Every stable public application API uses an `/api/v1` prefix; current
`/api/consultation` routes are development inputs and receive no public
compatibility promise.

The BFF's application-owned login, callback, logout, and session routes are
`/api/v1/auth/login`, `/api/v1/auth/callback`, `/api/v1/auth/logout`, and
`/api/v1/auth/session`. The versioned OpenAPI document is
`/api/v1/openapi.json`. Standards-defined identity-provider and MCP discovery
locations retain the paths required by their specifications.

Browser logout uses a same-origin POST, clears the BFF session and cookie, and
returns 303 to the discovered OIDC end-session endpoint with `client_id` and
the fixed `/signed-out` return URL. It works without a live BFF session.
Keycloak confirms logout before ending the current browser SSO session; no
tokens are placed in the logout URL. With `Accept: application/json`, the API
returns 200 and `logout_url`; the UI navigates there directly, avoiding
cross-origin form redirects under the site's form-action CSP.
The signed-out route does not start login
automatically. Other browser/device sessions are outside this logout's scope.

Application-owned health routes also declare V1: `/api/v1/health`,
`/mcp/v1/health`, and `/internal/v1/health`. They return minimal liveness only.

| Current route | V1 contract | Disposition |
| --- | --- | --- |
| `/api/consultation/binaries` | `/api/v1/binaries` | Include |
| `/api/consultation/binaries/:sha256` | `/api/v1/binaries/:sha256` | Include |
| `/api/consultation/representations/:id/content` | `/api/v1/representations/:id/content` | Include |
| `/api/consultation/court-records` | `/api/v1/court-records` | Include |
| `/api/consultation/references/lookup` | `/api/v1/references/lookup` | Include |
| `/api/consultation/reference-pilot/search` | `/api/v1/search` | Include; remove experimental naming |
| `/binary/:sha256` | `/api/v1/binaries/:sha256/content` | Replace; accept a browser session or API bearer token |
| `/api/consultation/reports/extraction-coverage` | none | Exclude |
| `/api/consultation/graphs/**` | none | Exclude |
| `/api/consultation/reference-pilot/references/:value` | none | Exclude |

The same versioned binary-content contract supports an authenticated browser
session and a separately authenticated programmatic bearer client. The private
gateway operation is `/internal/v1/binaries/:sha256/content` and has no public
ingress.

The existing response shapes and query semantics used by the included UI and
MCP operations are inputs to the first `/api/v1` contract. Before V1.2 begins,
a checked and hashed OpenAPI description plus representative golden fixtures
must freeze success envelopes, pagination, validation errors, not-found
behavior, content types, binary streaming/range behavior, and response limits.
Local paths and internal errors are never contract fields.

## MCP V1 Contract

The V1 MCP is published at `/mcp/v1`, declares the Consultation V1 application
contract in server metadata, and retains exactly four tools:

| Tool | Purpose | Mutation |
| --- | --- | --- |
| `search_document_text` | Search selected or full corpus text | None |
| `query_court_records` | Query structured case, bucket, document, and binary metadata | None |
| `get_binary_details` | Retrieve structured details for one SHA-256 identity | None |
| `get_representation_content` | Read bounded text, Markdown, complete-text, or native JSON representation content | None |

Their current argument schemas, bounded pagination, and error behavior are
inputs to the V1 contract. Before V1.2, checked and hashed input/output JSON
Schemas, error definitions, content-encoding rules, and representative golden
fixtures must freeze the wire contract. The released server preserves the
`readOnlyHint`, exposes no arbitrary SQL/filesystem operation, and omits
original binary bytes. Original files remain available through the
authenticated HTTP API/site flow.

The current HTTP MCP transport is a local experiment: it binds to loopback,
uses one static bearer secret, authenticates its health endpoint, and accepts
`POST /mcp`. It is not the release transport. V1 replaces the static token with
the Keycloak/OAuth resource-server contract defined in architecture note 21
and publishes `POST /mcp/v1` as the V1 application endpoint. A breaking V2 uses
`/mcp/v2`; both major versions may coexist during a documented migration.

## Runtime Write Audit

The currently exercised consultation API, binary gateway, and MCP tool handlers
perform database reads. `LocalBinaryStore` reads canonical artifacts and does
not modify them. The operational logger writes outside the corpus, but its
current redaction does not cover POSIX/container paths. The production logger
must redact credentials, tokens, Windows paths, POSIX paths, container mounts,
and stack traces before V1 release.

Two imported support modules also contain mutation functions:

- `processing-store.mjs` contains job, representation, segment, and selection
  writes, although consultation currently imports only its representation read;
- `reference-search-store.mjs` contains reference seed/review writes, although
  consultation invokes only lookup/search reads.

The production images must exclude mutation entry points or split the read
queries into release-only modules. Runtime database roles are the final
enforcement boundary: API, MCP, and gateway roles receive only the required
`SELECT` privileges. The canonical binary mount is read-only. Operational and
identity logs use separate writable storage.

The current Compose file does not satisfy this boundary: it exposes PostgreSQL,
Directus, and the binary gateway on host ports; mounts the repository writable
into the gateway; and gives services the shared database owner credentials.
It remains development configuration and must not be promoted as V1.

## Schema Baseline

The baseline schema is repository bootstrap state plus migrations
`2026-08-30-001` through `2026-09-05-015`, inclusive. Migration 015 separates
source-data time from import-execution time and is part of the baseline. The
current `db/init/001-bootstrap.sql` SHA-256 is
`9e76d94116d1bc4a3ff831ba030a69e5572360f5c259a0a34af66d9f915f8f44`.

The earlier companion manifest under `docs/architecture/` records the initial
inventory. The generated manifest under `release/consultation-v1/baseline/` is
the cryptographic V1.1 release input and supersedes it for verification.

Before V1.2, a deterministic repository generator/verifier must own the exact
read-only SQL definitions and produce a machine-readable manifest containing:

- the generator Git identity and query-definition hash;
- every bootstrap and migration filename and SHA-256 value;
- a normalized restored-schema fingerprint;
- a sorted relative-path, size, and SHA-256 inventory for the complete source
  package, all original binaries, and every released representation artifact;
- the immutable V1.1 input database snapshot hash and procedure;
- reproducible row-count and coverage assertions;
- the reference/search projection identity.

The final release backup is a distinct artifact created after candidate
configuration; it does not replace or retroactively redefine the V1.1 input
snapshot. Its hash, application image digests, and acceptance results are added
to the release manifest later. A restored candidate must reproduce all
applicable assertions before promotion.

## Compatibility Rules

Within `/api/v1` and `/mcp/v1`, compatible changes may add optional response
fields, improve documentation, correct implementation defects without changing
document identity, and add newly recognized enum values when clients are
required to tolerate unknown values.

The following require a new version or an explicitly coordinated migration:

- removing or renaming a route, tool, argument, or response field;
- changing a field type, required status, identity meaning, pagination model,
  default search scope, or ordering semantics;
- weakening authentication, audience, scope, or read-only rules;
- treating derived interpretation as canonical source fact;
- changing binary identity away from SHA-256;
- exposing previously excluded experimental or administrative operations as if
  they were part of V1.

A future breaking HTTP or MCP contract uses a new major route. MCP V2 therefore
uses `/mcp/v2` and may coexist with `/mcp/v1` during a documented migration.

UI implementation may change without a protocol version when it continues to
consume the compatible V1 backend contract.

## V1.2 Entry Conditions

The deterministic release inventory and hashed HTTP and MCP wire contracts
described above were generated and verified successfully on 2026-09-08. V1.2
may therefore begin. It must build a
production-only Compose topology and images, create separate read-only database
roles, mount evidence read-only, package only the three included UI flows, add
the `/api/v1` adapter and versioned binary-content operation, and keep all public
origin ports behind the future ingress. Authentication is added in V1.3; until
then the V1.2 package is candidate infrastructure and must not be published.
