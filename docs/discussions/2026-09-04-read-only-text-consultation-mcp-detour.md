# Read-only text-consultation MCP detour

## Status

This is an explicitly disposable **v1 MVP experiment** for evaluating AI consultation over existing search data. It may be replaced or deprecated after the experiment. Its tool names and response shapes carry no compatibility promise, and it is not a foundation for future review, annotation, or other write workflows.

## Boundary

This temporary detour exposes only already-existing consultation reads:

1. `search_document_text`
2. `get_binary_details`
3. `get_representation_content`

Recorded-reference lookup, extracted-reference observations as a standalone capability, v5/v6 ingestion, graph traversal, review/editing tools, and all writes are excluded. Search responses deliberately omit passage and contextual reference-observation payloads even though the existing internal search read model can provide them.

The original binary remains canonical evidence. Representation content remains processor-attributed derived content and is never merged into a preferred or synthetic representation.

## Implemented dependency-free layer

`app/text-consultation-mcp-tools.mjs` freezes the three tool schemas and supplies an injected read-only dispatcher over the existing consultation functions. It provides:

- full-corpus text scope by default, with optional pilot scope;
- existing relevance and recorded-occurrence-date ordering;
- pagination by distinct binary, as implemented by the existing search read model;
- full SHA-256 identity, processor/version, segment, location, and procedural contexts;
- binary details without individual processing-attempt payloads;
- bounded representation reads using zero-based Unicode-code-point offsets;
- a maximum of 20 binaries per search and 50,000 characters per content call;
- explicit coverage and canonical/derived-content semantics.

The adapter makes no database writes and introduces no schema or API changes.

## Round 1 transport

Round 1 uses the official JavaScript MCP SDK and a local stdio process. `app/text-consultation-mcp-server.mjs` registers exactly the three frozen tools, connects directly to the existing read models through one PostgreSQL client, marks all tools read-only, and sanitizes errors so local paths and stack traces are not returned to consumers.

The server is started with `npm run start:mcp:text-consultation`. Protocol-level tests cover initialize/connect, `tools/list`, `tools/call`, schema rejection, sanitized application errors, and clean in-memory transport shutdown.

No HTTP consultation server is required for the stdio MCP.

For private remote evaluation, Round 1 also supplies a Streamable HTTP entry
point backed by the identical tool dispatcher. It binds to localhost by
default, requires a long bearer token, validates the request Host, limits JSON
request bodies, and is intended to sit behind private Tailscale Serve HTTPS.
This transport does not broaden the three-tool contract or make the MVP a
public service. PostgreSQL remains private and is never exposed directly.

The MCP binary-detail projection deliberately omits the consultation UI's local
`original_binary_url`. Round 1 does not deliver or download original binaries;
it reports that original content is unavailable through this MCP while retaining
the SHA-256 canonical-evidence identity. The underlying consultation API and
local file gateway remain unchanged.

## Round 2 is deferred

Consolidated document-record queries, APIs, reference lookup, graphs, and any expansion beyond the original three tools belong to a separately planned Round 2. None is designed or partially implemented here.

Text-search coverage depends on existing indexed nonblank representations; a no-match result does not prove that a document or fact is absent.
