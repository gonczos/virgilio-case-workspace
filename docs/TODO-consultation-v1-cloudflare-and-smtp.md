# Consultation V1 Cloudflare And SMTP Setup Checklist

Last updated: 2026-09-08

## Purpose

Complete this checklist before finalizing
`deploy/consultation-v1/.env`. It covers the external Cloudflare and SMTP
dependencies for the Consultation V1 candidate environment.

This file is a checklist and a place to record non-secret decisions. Never put
tunnel tokens, SMTP passwords, account recovery codes, client secrets, or other
credentials in this document, Git, screenshots, logs, or messages.

Known starting state:

- [x] A Cloudflare account exists.
- [x] Transfer of the intended domain to Cloudflare has been initiated.
- [x] A Google app password was generated for SMTP testing.
- [x] The previously shared Google app password has been revoked and replaced.

The replacement is required because the earlier credential was exposed in a
conversation. Record only that rotation was completed.

## 1. Record The Public Names

The chosen base domain is `asiloveit.com`. Use single-level subdomains so the
hostnames fit normal `*.asiloveit.com` certificate coverage without depending
on a certificate for `*.virgilio.asiloveit.com`.

| Purpose | Final hostname |
| --- | --- |
| Consultation website and browser API | `virgilio.asiloveit.com` |
| Direct programmatic API | `api-virgilio.asiloveit.com` |
| Remote MCP | `mcp-virgilio.asiloveit.com` |
| Keycloak login and account pages | `auth-virgilio.asiloveit.com` |

Requirements:

- [x] Every final hostname is under the intended Cloudflare-managed zone.
- [x] Each hostname is distinct.
- [x] No hostname is already used by another service. Verified on 2026-09-08:
      public DNS returned no A, AAAA, or CNAME record for the four selected
      names; both authoritative
      Cloudflare nameservers returned no A or CNAME answer; and a random
      hostname confirmed that no wildcard DNS record occupies them.
- [x] The site, API, MCP, issuer, audiences, redirects, and tunnel routes will
      use these exact names.

Treat these names as frozen when creating the final `.env`. Changing the
authentication hostname later changes the OIDC issuer identity.

## 2. Finish The Cloudflare Domain Prerequisites

- [x] Wait until the domain appears as **Active** in Cloudflare.
- [x] Confirm the authoritative nameservers and zone DNS are managed by the
      intended Cloudflare account.
- [x] Review the imported DNS records and remove or correct stale conflicts for
      the four chosen hostnames.
- [x] Confirm Cloudflare can issue edge certificates for all four hostnames.
- [x] Confirm the deployment machine can make outbound connections required by
      `cloudflared`; do not add inbound router or firewall port forwarding.
- [ ] Enable strong MFA for the Cloudflare account and retain recovery access in
      the operator's password manager.

## 3. Create The Cloudflare Tunnel

Use a remotely managed tunnel. The repository already contains the pinned
`cloudflared` Compose service, so do not install a separate system service for
this deployment.

- [x] In Cloudflare, open **Networking > Tunnels** and create a tunnel named for
      this deployment, for example `virgilio-consultation-v1`.
- [x] Copy the tunnel token once into the ignored file
      `deploy/consultation-v1/secrets/cloudflare_tunnel_token.txt`.
- [x] Restrict that file to the deployment operator.
- [x] Do not put the token itself in `.env`; `.env` contains only
      `CLOUDFLARE_TUNNEL_TOKEN_FILE`.
- [x] Add the following published-application routes. These service names are
      resolved inside the Compose `edge` network.

| Public hostname | Tunnel service URL |
| --- | --- |
| `virgilio.asiloveit.com` | `http://ui:8080` |
| `api-virgilio.asiloveit.com` | `http://api:8091` |
| `mcp-virgilio.asiloveit.com` | `http://mcp:8092` |
| `auth-virgilio.asiloveit.com` | `http://keycloak:8080` |

- [x] Confirm Cloudflare created proxied DNS records for all published routes.
- [x] Do not create a public route to `gateway`, either PostgreSQL database, or
      any Docker/host management endpoint.
- [x] Leave the tunnel stopped until the `.env`, secrets, and local health
      checks are complete.

Cloudflare's current dashboard procedure is documented in
<https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/>.

## 4. Configure Cloudflare Safety Rules

Create a Cache Rule whose action is **Bypass cache** with this expression:

```text
(http.host eq "api-virgilio.asiloveit.com") or
(http.host eq "mcp-virgilio.asiloveit.com") or
(http.host eq "auth-virgilio.asiloveit.com") or
((http.host eq "virgilio.asiloveit.com") and
 starts_with(http.request.uri.path, "/api/v1/"))
```

This permits the website's versioned static files to use their origin cache
headers while keeping authenticated data, documents, OAuth responses, and MCP
traffic out of Cloudflare's shared cache.

- [x] Deploy the cache-bypass rule.
- [x] Check rule ordering so a later rule cannot make these requests cacheable.
- [x] Do not create a Cache Everything rule for the four service hostnames.
- [ ] If the current Cloudflare plan supports a suitable rate-limit rule, an
      edge limit may be added to `/api/v1/auth/login`. The application limit is
      already mandatory, so this edge rule is optional.
- [x] Create a Cloudflare custom rule with action **Block** for this expression:

      ```text
      (http.host eq "auth-virgilio.asiloveit.com") and
      (starts_with(http.request.uri.path, "/admin") or
       starts_with(http.request.uri.path, "/realms/master"))
      ```

      Keycloak documents that its administration hostname changes generated
      URLs but does not remove the Admin REST API from the frontend listener.
      See <https://www.keycloak.org/server/hostname>.
- [x] Do not put Cloudflare Access in front of the public authentication, site,
      API, or MCP hostnames; doing so would add a second authentication protocol
      that can break OIDC and MCP clients.

### Local Keycloak administration

Normal operation publishes no Keycloak host port. Administration is a bounded
maintenance operation:

1. Stop `cloudflared` so public authentication and consultation are offline.
2. Recreate only Keycloak with both Compose files:

   ```powershell
   docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml -f deploy/consultation-v1/compose.admin-local.yml up -d --no-deps --force-recreate keycloak
   ```

3. Open `http://localhost:8088/admin/` on the deployment host and perform the
   administration.
4. Recreate Keycloak from the base Compose file only.
5. Verify public OIDC discovery and login, then restart `cloudflared`.

The override binds only `127.0.0.1` and temporarily makes the Keycloak frontend
and admin URLs local. Do not use it while public consultation is expected to
remain available. Do not add a local site, API, MCP, gateway, or database port.

Cache Rule documentation:
<https://developers.cloudflare.com/cache/how-to/cache-rules/>.

## 5. Prepare Google SMTP

The current Keycloak realm expects authenticated SMTP with STARTTLS on port
587. The initial values are:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP transport=STARTTLS
SMTP authentication=enabled
```

- [x] Choose the dedicated Google mailbox that will send Consultation V1
      identity email.
- [x] Confirm 2-Step Verification is enabled for that Google account.
- [x] Revoke the app password previously shared in conversation.
- [x] Generate a new app password at
      <https://myaccount.google.com/apppasswords>.
- [x] Put only the replacement credential in the ignored file
      `deploy/consultation-v1/secrets/smtp_password.txt`.
- [x] Record the full mailbox address as the future `SMTP_USER` value.
- [x] Use the same mailbox for `SMTP_FROM` during initial testing. Use a
      different From address only after Google is configured to permit that
      sender identity.
- [x] Choose the sender display name; the default is `Virgilio Consultation`.
- [x] Choose a test recipient controlled by the operator. The sending mailbox
      itself is the initial self-test recipient.
- [ ] Record the app-password creation/rotation date in the password manager.

Google notes that app passwords require 2-Step Verification and are revoked
when the Google Account password changes. See
<https://support.google.com/accounts/answer/185833>.

SMTP authentication with the configured mailbox and replacement app password
was first verified over STARTTLS on 2026-09-08 without sending a message. Gmail
then accepted one self-test message to the sending mailbox. The same settings
were applied to the existing `consultation` Keycloak realm.

For a fresh production identity database, SMTP and public URL values must be
correct before Keycloak first imports the realm. If the realm already exists,
changing the realm JSON or `.env` does not re-import it; update SMTP through the
Keycloak administration console or deliberately initialize a new candidate
identity volume.

## 6. Information Required For `.env`

When Sections 1-5 are complete, provide or record these non-secret values:

| `.env` setting | Value to derive |
| --- | --- |
| `SITE_PUBLIC_URL` | `https://virgilio.asiloveit.com` |
| `API_PUBLIC_URL` | `https://api-virgilio.asiloveit.com` |
| `MCP_PUBLIC_URL` | `https://mcp-virgilio.asiloveit.com/mcp/v1` |
| `AUTH_PUBLIC_URL` | `https://auth-virgilio.asiloveit.com` |
| `AUTH_ADMIN_LOCAL_PORT` | `8088` |
| `OIDC_ISSUER` | `https://auth-virgilio.asiloveit.com/realms/consultation` |
| `API_AUDIENCE` | `https://api-virgilio.asiloveit.com/api/v1` |
| `MCP_AUDIENCE` | `https://mcp-virgilio.asiloveit.com/mcp/v1` |
| `MCP_ALLOWED_HOSTS` | `mcp-virgilio.asiloveit.com` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Full Google mailbox address |
| `SMTP_FROM` | Approved sender address; initially the same as `SMTP_USER` |
| `SMTP_FROM_DISPLAY_NAME` | Chosen human-readable sender name |
| `CLOUDFLARE_TUNNEL_TOKEN_FILE` | `./secrets/cloudflare_tunnel_token.txt` |

The following secret values must exist in ignored files but must not be copied
into `.env` or this checklist:

- `cloudflare_tunnel_token.txt`
- `smtp_password.txt`
- generated database passwords
- Keycloak bootstrap password
- OIDC client secret
- internal gateway token

## 7. Dependency-Ready Gate

Cloudflare and SMTP are ready for `.env` work when all of these statements are
true:

- [x] The Cloudflare zone is Active.
- [x] The four exact public hostnames are recorded.
- [x] The remotely managed tunnel and four routes exist.
- [x] The tunnel token is present only in its ignored secret file.
- [x] Cache bypass and public Keycloak administration-block rules are configured.
- [x] Keycloak local maintenance mode has been tested end to end: public ingress
      stops, the loopback console login works, normal public identity settings
      are restored, and no public administration hostname or Tunnel route exists.
- [x] No direct public origin port or gateway/database route exists.
- [x] The replacement Google app password is present only in its ignored secret
      file.
- [x] SMTP username, From address, and display name are recorded.
- [x] No secret value appears in `.env`, Git, this document, or operational
      notes.

After this gate passes, complete `deploy/consultation-v1/.env`, validate the
Compose rendering, start the unexposed services, test Keycloak email, and only
then start the `publish` profile.

## 8. Deployment Verification Record

The candidate was published and checked on 2026-09-08:

- [x] `.env` contains the four approved HTTPS public URLs, the exact OIDC
      issuer, the API and MCP audiences, and the allowed MCP host.
- [x] The existing Keycloak realm contains the public browser callback and
      origin, plus the matching API and MCP audience mappers.
- [x] Normal operation exposes no host ports. The UI, API, MCP, binary gateway,
      Keycloak, and both PostgreSQL services report healthy.
- [x] The `publish` profile runs the pinned `cloudflared` image, receives the
      remotely managed ingress configuration, and established four QUIC tunnel
      connections after all connectivity pre-checks passed.
- [x] HTTPS succeeds on all four public hostnames. The site, API health, MCP
      health and protected-resource metadata, and OIDC discovery endpoints
      respond successfully.
- [x] OIDC discovery reports the exact public issuer. The website login route
      redirects to a usable Keycloak login form with the approved public
      callback, API audience, PKCE, state, and nonce parameters.
- [x] Unauthenticated consultation API and MCP requests are rejected. The MCP
      challenge points to the public protected-resource metadata endpoint.
- [x] Authenticated-data and identity responses use private/no-store cache
      controls and Cloudflare reports dynamic handling rather than a cache hit.
- [x] Public requests to `/admin` and `/realms/master` on the identity hostname
      are blocked with HTTP 403.

The two remaining unchecked items in this document are operator account
hygiene: Cloudflare account MFA/recovery storage and recording the Google app
password rotation date in the password manager. The optional edge login rate
limit is not a publication blocker because the application already enforces its
own bounded login-start limit.
