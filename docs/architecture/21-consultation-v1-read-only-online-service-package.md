# Consultation V1 Read-only Online Service Package

Last updated: 2026-09-08

## Status

Agreed target architecture for the final Consultation v1 phase. This document
defines the package boundary and the conditions for calling it ready. It does
not claim that public hosting, Docker-first packaging, shared authentication,
or clean-machine deployment is implemented yet.

The verified current setup remains documented in `docs/SETUP.md`. Unresolved
setup and portability work remains tracked in
`docs/TODO-setup-and-portability.md`.

## Purpose

Close the current project phase as a stable, read-only online consultation
service over the data already collected and processed. The release must support
human consultation through the site and API and AI consultation through a
vendor-neutral remote MCP endpoint.

After the release is frozen, ongoing schema, import, processing, search, and UI
development must be able to continue without exposing intermediate breaking
changes to Consultation v1 users such as Virgilio.

## Release Boundary

The Consultation v1 runtime contains only the services and data required to
consult the frozen corpus:

```text
Internet clients
  |
  v
Cloudflare DNS, TLS, and Tunnel
  |
  +--> consultation public site and authenticated browser API/BFF
  +--> authenticated programmatic consultation API
  +--> read-only remote MCP
  +--> public Keycloak login endpoints

Private Docker network
  |
  +--> consultation UI
  +--> consultation API/BFF
  +--> private binary gateway
  +--> consultation MCP
  +--> consultation PostgreSQL snapshot
  +--> Keycloak
  +--> separate Keycloak PostgreSQL database
  +--> cloudflared
```

The online package excludes:

- source scraping;
- imports and migrations initiated at runtime;
- processing workers and processor dependencies;
- corpus reindexing;
- enrichment, review, annotation, or other mutation tools;
- PostgreSQL, Directus, Keycloak administration, or container ports exposed
  directly to the Internet.

Directus remains an administrative/raw consultation surface where needed, but
it is not part of the public Consultation v1 surface.

## Stable Release And Continued Development

Consultation v1 is a named, immutable release rather than a continuously
changing deployment from the development branch. Its reproducibility boundary
must include:

- an annotated Git release tag;
- pinned application dependency and container-image versions;
- a versioned database schema and migration level;
- an identified corpus snapshot and derived search projection;
- versioned public API and MCP contracts;
- versioned, secret-free Keycloak realm/client configuration;
- deployment configuration and an operator runbook;
- backup and restore instructions;
- acceptance-test results for the released package.

Production deployment must use the frozen release and its compatible database
snapshot. Development uses a different checkout, deployment project, database,
storage paths, secrets, and hostnames. A development migration must never run
against the v1 consultation database.

A later release may replace v1 only through an explicit promotion procedure:

1. restore or clone production data into an isolated candidate environment;
2. apply and validate the candidate migration there;
3. run contract, authorization, search, and corpus-integrity checks;
4. create a backup and documented rollback point;
5. promote the versioned package deliberately.

## Read-only Guarantee

Read-only operation is enforced in layers:

1. Public site behavior exposes consultation operations only.
2. Every endpoint returning consultation data requires authentication and the
   `consultation.read` scope. This includes search, court metadata, references,
   document and representation content, binary metadata, and original-binary
   delivery.
3. The public API permits only the agreed safe read methods and routes.
4. The MCP publishes only tools marked and implemented as read-only.
5. API, gateway, and MCP database credentials have `SELECT` access only to the
   required consultation objects.
6. The deployment does not run importers, processors, migration runners, or
   administrative database tools.
7. Original binaries and packaged evidence storage are mounted read-only where
   the runtime permits it.
8. Authentication, access audit, and operational logs write to stores separate
   from the canonical corpus.

The only unauthenticated HTTP surfaces are static site assets, login initiation
and callbacks, standards-required OAuth/OIDC/MCP discovery metadata, and a
minimal health endpoint that discloses no corpus or infrastructure details.

The binary gateway has no public ingress route. Browser binary requests pass
through the authenticated API/BFF, which checks the session and scope before
retrieving the binary from the gateway over the private Docker network. A URL
or SHA-256 value alone never grants access to an original court document.

The Keycloak database is necessarily writable because it owns accounts,
credentials, sessions, and authentication events. That does not weaken the
read-only status of the court corpus.

Health checks should be unauthenticated only when they return no sensitive
state. Metrics, diagnostics, and administration endpoints remain private.

## Shared Authentication Foundation

Keycloak is the selected shared identity provider for the site, API, MCP, and
future services. It runs as a pinned production-mode container with its own
PostgreSQL database. Application code must not implement password storage,
primary authentication, identity-provider SSO sessions, OAuth token issuance,
credential recovery, or MFA. The consultation BFF owns only the relying-party
browser session described below.

The shared identity service provides:

- login, logout, credential recovery, and optional MFA/passkeys;
- account activation, disabling, session revocation, and identity audit;
- OAuth 2.1/OpenID Connect clients, scopes, roles, and token issuance;
- a stable external subject identity expressed as `(issuer, subject)`.

Each service has a distinct client/resource identity and token audience. A
single universal access token must not grant access to every surface.

| Consumer | Authentication pattern | Resource/audience direction |
| --- | --- | --- |
| Site | Authorization Code with PKCE terminating in a BFF-managed browser session | consultation web client |
| API | Bearer access token | consultation API resource |
| MCP | OAuth 2.1 bearer token plus MCP protected-resource metadata | consultation MCP resource |
| Administration | Separate restricted client with mandatory MFA | identity/application administration |
| Future service | Client Credentials only when a concrete service-to-service need exists | service-specific resource |

The MCP server is an OAuth resource server. It validates tokens issued by the
identity provider and publishes the discovery/challenge metadata required by
the MCP authorization specification. It does not issue tokens. Dynamic client
registration or another standards-compliant client onboarding mechanism must
be tested with ChatGPT and at least one independent MCP client before the
authentication design is frozen.

The browser-facing site and data routes share one public origin. The browser
loads static assets, completes login at Keycloak, and receives a `Secure`,
`HttpOnly` session cookie from the consultation API/BFF. Browser JavaScript
continues to call relative `/api/...` and `/binary/...` URLs; it does not store
OAuth tokens in `localStorage` or other script-readable storage. The API/BFF
authenticates every data request and performs the binary-gateway call itself.

The v1 BFF owns an ephemeral relying-party session in process memory and gives
the browser only an opaque, unguessable session identifier. The corresponding
server-side record contains the issuer, subject, current access token and its
expiry, current refresh token and its lifecycle state, and BFF idle and absolute
expiry times. Token material is never placed in the browser cookie or logs.

Every browser data request must be authorized by an unexpired Keycloak access
token held in that BFF session. The BFF attempts renewal before token expiry,
replaces rotated refresh tokens atomically, and destroys the session when
renewal fails. Refreshes for one session are serialized so concurrent requests
cannot reuse a rotated refresh token. BFF idle and absolute expiry times cannot
extend authorization beyond the corresponding Keycloak token/session
lifecycle. Keycloak backchannel logout may destroy the BFF session sooner, but
the five-minute bound does not depend on that optional acceleration.

A BFF restart invalidates all in-memory sessions and requires users to
authenticate again. This deliberately avoids a persistent writable
application-session store in the single-instance v1 deployment. The cookie is
`Secure`, `HttpOnly`, and configured with an appropriate `SameSite` policy; the
BFF also validates request origins. A later multi-instance deployment must
introduce an explicit shared session store with separate ownership, backup, and
lifecycle rules.

A separately published programmatic API accepts OAuth bearer tokens. It
does not weaken or bypass the same `consultation.read` authorization policy.
The MCP accepts OAuth bearer tokens for its own resource audience.

Consultation v1 uses short-lived access tokens with a target maximum lifetime
of five minutes. Disabling an account or revoking its sessions prevents token
renewal; an already issued access token can remain usable until it expires. The
maximum accepted revocation latency is therefore five minutes. Offline access
tokens are not permitted. Refresh-token rotation is enabled where the client
supports it. Resource servers fail closed when they cannot validate a token.

Cloudflare Access may add protection to administration endpoints. It is not the
MCP authorization protocol and must not make the MCP dependent on a particular
AI client or vendor.

## Identity And Application Authorization

Keycloak establishes who the caller is and supplies the v1 role and scope. The
first release contains one invited-user corpus: every enabled user with the
`consultation_user` role and `consultation.read` scope may consult that corpus.
Consultation v1 does not persist an application-user mapping or case-specific
access grants and therefore does not require a writable application
authorization store.

Applications consume a provider-neutral principal contract conceptually shaped
as:

```text
AuthenticatedPrincipal
  issuer
  subject
  display_name
  roles
  scopes
  authenticated_at
```

The durable external identity key is `(issuer, subject)`. Display names and
email addresses are mutable attributes and are not identity keys. Access and
operational logs may record the issuer and subject in a store separate from the
corpus database.

The v1 application authority is deliberately small:

- `consultation_user` as the application role;
- `consultation.read` for the public consultation resources.

Additional write, review, or case-management permissions are outside v1.
Keycloak administration uses delegated Keycloak administrative permissions,
not an application role emitted in consultation tokens. Bootstrap/recovery
administration remains separate from routine realm administration.

When a later release requires different users to see different cases or
workspaces, it must add an explicit application-authorization store and
administration path. That future store may map `(issuer, subject)` to an
internal user and case grants, but it must remain separate from the canonical
court corpus and must have its own writable owner, audit, backup, and lifecycle
rules. This deferred capability must not be inferred from the v1 role model.

## User Administration

Consultation v1 uses invite-only account administration:

1. self-registration is disabled;
2. a realm administrator creates or invites the user;
3. the user verifies the email address and chooses a private password;
4. administrators can disable the account and revoke its sessions;
5. users manage their own password, MFA, and sessions through the identity
   provider's account console.

Administrative responsibilities are separated:

- a bootstrap/recovery administrator is reserved for emergencies;
- a delegated realm administrator manages users and authentication policy;
- a future application administrator may manage case access after a separate
  application-authorization store is deliberately introduced.

Routine accounts do not receive unrestricted master-realm administration.
Administrator MFA is mandatory. The administration hostname is separately
protected and is not advertised as part of the public consultation product.

## Configurable Public URLs

No real domain, hostname, redirect URI, issuer URL, or origin is compiled into
application code, realm exports, or container images. The target configuration
contract uses explicit URLs such as:

```env
PUBLIC_BASE_DOMAIN=example.invalid

SITE_PUBLIC_URL=https://consultation.example.invalid
API_PUBLIC_URL=https://api.example.invalid
MCP_PUBLIC_URL=https://mcp.example.invalid
AUTH_PUBLIC_URL=https://auth.example.invalid
AUTH_ADMIN_PUBLIC_URL=https://identity-admin.example.invalid

OIDC_ISSUER=https://auth.example.invalid/realms/consultation
```

These names describe the intended configuration surface; they are not yet
implemented variables. Implementation may refine the names, but it must retain
the same explicit and portable semantics.

OAuth redirect URIs, post-logout redirect URIs, allowed origins, token
audiences, MCP resource identifiers, and Cloudflare Tunnel host mappings are
configured explicitly. Production must use exact HTTPS origins and redirect
URIs rather than permissive wildcards.

Secrets are supplied separately from this public-URL configuration and remain
outside Git and exported realm configuration.

## Public Contract Policy

The current text-consultation MCP is documented as a disposable experiment and
its private HTTP transport uses a static bearer token. It is therefore an input
to the v1 contract audit, not yet the released public contract.

The current candidate MCP surface contains:

- `search_document_text`;
- `query_court_records`;
- `get_binary_details`;
- `get_representation_content`.

Before release, schemas, response limits, pagination, error envelopes,
canonical-versus-derived semantics, and tool descriptions must be reviewed and
recorded as the v1 contract. Once frozen, compatible fixes may be released
under v1; breaking changes require a new versioned API/MCP surface or a new
major consultation release.

The site may evolve independently inside the stable backend contract. The API
and MCP must never expose local filesystem paths, database credentials,
internal stack traces, or unrestricted query execution.

## Data Package And Integrity

The production data snapshot includes only the corpus and derived projections
required for consultation. It preserves the repository's existing evidence
boundaries:

- original binaries remain immutable canonical evidence;
- representations, segments, extracted references, and search indexes remain
  derived data with input and processor lineage;
- imported court labels remain source observations rather than verified legal
  classifications;
- missing source records, missing binaries, extraction failures, and search
  misses remain distinct states.

The release manifest must identify at least:

- schema/migration version;
- corpus/import identity and source-data time where available;
- binary counts, byte totals, and integrity-check results;
- representation and indexed-segment coverage;
- reference/search projection version;
- application release identifier.

The database and evidence storage must be backed up together at a consistent
release point. Restore verification is an acceptance requirement, not only an
operator instruction.

## Operational Requirements

The online package must provide:

- pinned Docker images and one documented Compose entry point;
- persistent volumes with explicit backup ownership;
- restart policies and dependency health checks;
- structured, redaction-safe operational logging;
- authentication and administrator event retention;
- resource limits suitable for the selected host;
- database connections restricted by service role;
- no public origin ports other than traffic entering through the chosen HTTPS
  ingress;
- a procedure to rotate secrets without rebuilding application images;
- a documented update, backup, restore, and rollback procedure.

The package should run on ordinary Docker Engine/Compose and must not require a
specific AI application. Cloudflare is the initial ingress provider, not part
of canonical evidence or application-domain semantics.

Capacity must be measured before selecting the final host. A 2 GB RAM / 2 vCPU
host may be too constrained for Keycloak, two PostgreSQL workloads, the API,
MCP, gateway, and UI together without careful limits. The release decision must
use observed idle, login, search, and concurrent-request measurements.

## Implementation Sequence

### V1.1: Freeze inventory and contracts

- identify the exact code, schema, corpus, representations, and indexes to
  release;
- audit the current UI, API, binary gateway, and four MCP tool contracts;
- record compatibility rules and version identifiers;
- inventory every route that returns consultation data and classify it as an
  authenticated browser, programmatic API, or MCP surface;
- inventory all runtime writes and remove or isolate corpus mutations.

### V1.2: Package the read-only runtime

- build production UI, API, gateway, and MCP images;
- create the production Compose topology and persistent-volume contract;
- exclude import and processing dependencies from the online runtime;
- create read-only database roles and storage mounts;
- keep the binary gateway private and route browser binary delivery through the
  authenticated API/BFF;
- add health checks and bounded resource configuration.

### V1.3: Establish shared identity

- deploy pinned Keycloak and its separate PostgreSQL database;
- create secret-free, versioned realm/client configuration;
- implement the provider-neutral principal adapter;
- implement the site's BFF-managed ephemeral session and protect every
  consultation-data route;
- bind each BFF session to current Keycloak access/refresh token state,
  serialize refresh-token rotation, and destroy sessions on failed renewal;
- protect the programmatic API and MCP with distinct clients/audiences;
- configure a five-minute maximum access-token lifetime, prohibit offline
  access, and enable refresh-token rotation where supported;
- configure invite-only administration, recovery, MFA, session, and audit
  policies.

### V1.4: Publish a candidate environment

- configure domain-independent public URLs and exact redirect/origin lists;
- publish through Cloudflare Tunnel;
- test OAuth/MCP interoperability using the owner's ChatGPT account and an
  independent MCP client;
- test direct site and API access, session-cookie security, bounded revocation,
  expired tokens, wrong audiences, and insufficient scopes;
- test account disabling and session revocation through both a browser cookie
  and bearer-token clients, including the five-minute maximum delay;
- test that anonymous and unauthorized requests cannot retrieve metadata,
  search results, representations, binary metadata, or original binaries.

### V1.5: Release and hand off

- create and verify backups and a clean restore;
- run corpus integrity, contract, authorization, and smoke tests;
- tag the immutable release and record image digests;
- publish the operator and user runbooks;
- create Virgilio's account and perform an observed read-only consultation;
- retain the candidate environment as the rollback point until acceptance.

## Acceptance Gates

Consultation v1 is ready only when all of the following are evidenced:

- a clean host can start the package from the documented release inputs;
- the data snapshot restores successfully and passes integrity checks;
- the site supports the agreed search and document consultation flow;
- the API and MCP expose only the frozen read contract;
- an authenticated user can use both the site and a remote MCP client;
- every endpoint returning consultation data requires authentication and the
  correct scope;
- original binaries can be reached only through an authenticated consultation
  route, and the binary gateway has no public ingress route;
- unauthenticated, expired, wrong-audience, insufficient-scope, and disabled-user
  requests fail according to the documented token-lifetime policy;
- disabling an account or revoking its sessions prevents token renewal, and
  any previously issued access token stops working within five minutes;
- every browser data request is backed by an unexpired Keycloak access token;
  failed renewal destroys the BFF session, and its idle or absolute lifetime
  never extends Keycloak authorization;
- Keycloak administrative permissions are absent from consultation tokens;
- v1 has no writable application identity or case-grant store;
- runtime service database roles cannot mutate canonical or derived corpus data;
- neither APIs, MCP responses, logs, nor UI expose local filesystem paths or
  secrets;
- production and development deployments can run without sharing databases,
  storage, secrets, or hostnames;
- backup, restore, update, and rollback procedures have been exercised;
- resource measurements fit the selected hosting plan with an agreed margin.

## Deferred Beyond V1

- self-service public registration;
- write, annotation, enrichment, proposal, or review tools;
- multi-tenant organization administration;
- automated user provisioning through SCIM;
- sophisticated per-document policy management;
- high-availability Keycloak or PostgreSQL clusters;
- Kubernetes, service meshes, brokers, or distributed schedulers;
- live synchronization with the court source system;
- automatic promotion from development to production.

## References

- MCP authorization specification:
  <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>
- MCP TypeScript SDK authorization guidance:
  <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/authorization.md>
- Keycloak server administration guide:
  <https://www.keycloak.org/docs/latest/server_admin/>
- Keycloak OpenID Connect endpoints and token validation guidance:
  <https://www.keycloak.org/securing-apps/oidc-layers>
- Keycloak production container guidance:
  <https://www.keycloak.org/server/containers>
- Cloudflare Tunnel documentation:
  <https://developers.cloudflare.com/tunnel/>
