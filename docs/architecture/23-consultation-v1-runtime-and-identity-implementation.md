# Consultation V1 Runtime And Identity Implementation

Last updated: 2026-09-08

## Status

This note records the implemented V1.2 and V1.3 boundary. It complements the
acceptance contract in `21-consultation-v1-read-only-online-service-package.md`
and the frozen V1.1 input in
`22-consultation-v1-contract-and-runtime-baseline.md`.

The package is implemented and locally validated without public ingress. It is
not yet a published release candidate. V1.4 must supply real hostnames, test
the Cloudflare routes and OAuth clients, and exercise ChatGPT plus an
independent MCP client.

The cumulative correction review from baseline
`003e3642883a127fd021b6653cd8af5d66adf0d5` requires the V1.2/V1.3 runtime to
fail closed on invalid authentication-duration configuration, cap in-memory
login and session state, bind the ID-token subject to the access-token subject,
and materialize public OpenAPI discovery from deployment configuration. UI
representation reads and native PDF preflight checks use the same
reauthentication behavior as JSON reads. Optional MCP metadata fields are published only when their target
resource exists. These corrections do not change the frozen data model or
consultation response schemas.

## Runtime boundary

`deploy/consultation-v1/compose.yml` defines separate UI, API/BFF, MCP, private
gateway, corpus PostgreSQL, Keycloak, and Keycloak PostgreSQL services. The
Cloudflare connector is present only under the explicit `publish` profile.
No service maps a host port in the base file.

The application image copies only modules needed by the read services. It does
not contain importer, migration, processing-worker, enrichment, review, or
Directus entry points. Source binaries and representation artifacts are
read-only bind mounts. The corpus snapshot restores into an isolated volume.
API, MCP, and gateway use distinct roles granted only `CONNECT`, schema
`USAGE`, and table `SELECT`, with `default_transaction_read_only=on`.

The release UI builds with `VITE_CONSULTATION_V1=true`. It calls `/api/v1`,
redirects rejected JSON and representation reads plus native PDF preflight
checks to the versioned login operation, and
hides experimental coverage, graph, procedural-flow, and Directus navigation.
Development builds retain their existing routes.

## Identity boundary

Keycloak 26.7.3 runs in production mode with a separate writable database. Its
secret-free realm import creates the `consultation_user` role,
`consultation.read` scope, web/API/MCP clients, and distinct API/MCP audience
mappers. It creates no end-user accounts. Self-registration is disabled, TOTP
enrollment is a default required action, brute-force protection is enabled,
and identity/admin events are recorded.

Access tokens have a five-minute maximum lifetime. Refresh-token rotation uses
zero reuse. Offline access is not assigned to the clients. Runtime validation
requires issuer, resource audience, `consultation.read`, and
`consultation_user`.

The browser uses Authorization Code plus PKCE. The BFF validates state, nonce,
issuer, signatures, matching ID/access-token subjects, token audience,
lifetime, scope, and role. It keeps access
and refresh tokens in an in-memory server session and gives the browser only a
Secure, HttpOnly, SameSite=Lax opaque cookie. Refresh is serialized per session
and a failed refresh destroys it. Pending logins and sessions have fixed
capacity bounds. A restart invalidates sessions.

Provider error callbacks accept the standard `error`, `error_description`, and
`error_uri` parameters. They consume valid pending state and return a generic
`LOGIN_FAILED` response without exchanging tokens or reflecting provider text.
ID-token rejection remains fail-closed; server diagnostics record only a bounded
failure category (such as nonce/subject mismatch or a JOSE verification code),
never tokens or claim values. These diagnostics distinguish causes that the
public `INVALID_ID_TOKEN` response deliberately does not expose.

Before allocating login state, the BFF applies fixed-window admission limits
per Cloudflare client address and globally. The configured global rate and
window are validated against the five-minute pending-state lifetime and the
pending-state capacity, so accepted traffic cannot exhaust the state map.
Rejected requests use `429 LOGIN_RATE_LIMITED` and `Retry-After`. Tracked
client addresses are also bounded. Because the public client address comes
from `CF-Connecting-IP`, the deployment keeps every origin port private to the
tunnel; local unexposed requests fall back to the socket address.

API and MCP containers perform discovery, token exchange, refresh, and JWKS
retrieval through the Docker-internal Keycloak origin. They still validate the
public issuer exactly, and discovery continues to publish the public browser
authorization endpoint. This avoids a tunnel startup dependency cycle without
weakening issuer or audience validation.

The MCP endpoint publishes RFC 9728 protected-resource metadata, returns the
metadata URI in bearer challenges, and requires the exact MCP audience. The
server is a resource server and does not issue tokens.

## Configuration and secrets

Every public URL, issuer, audience, allowed host, storage path, and SMTP field
is environment configuration. Credentials are Docker secret files ignored by
Git and loaded at process startup. The repository records no domain, user,
SMTP password, database password, client secret, or tunnel token.

The served OpenAPI document retains the frozen portable contract but replaces
its example server and OAuth URLs at startup with `API_PUBLIC_URL` and the
authorization and token endpoints returned by OIDC discovery.

Original-file links open a same-origin UI route that checks the current session
and performs a protected `HEAD` request before navigating the new tab to the
original content URL. The embedded native PDF viewer uses the same preflight.
Development retains both `/api` and `/binary` Vite proxies.

The deployment and rotation procedure is in
`deploy/consultation-v1/README.md`. Google app-password management remains
linked there as the initial SMTP-provider procedure; the provider is
replaceable without an application-code change.

## Local evidence

The focused Node tests cover token lifetime/audience/scope/role rejection,
cookie attributes, BFF login/session behavior, API route protection, MCP
metadata/challenges, and log redaction. The existing UI suite and production V1
build pass. Compose parses, all five custom images build, the V1.1 database
snapshot restores, and the Keycloak realm imports in the isolated topology.

Public URLs, user creation, email delivery, real login, remote MCP onboarding,
Cloudflare caching, revocation timing, resource measurements, clean-host
restore, image digest freeze, and release backup remain V1.4/V1.5 acceptance
work.
