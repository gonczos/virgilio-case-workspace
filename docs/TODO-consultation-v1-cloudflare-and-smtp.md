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
| Restricted Keycloak administration | `identity-admin-virgilio.asiloveit.com` |

Requirements:

- [x] Every final hostname is under the intended Cloudflare-managed zone.
- [x] Each hostname is distinct.
- [ ] No hostname is already used by another service.
- [x] The site, API, MCP, issuer, audiences, redirects, and tunnel routes will
      use these exact names.

Treat these names as frozen when creating the final `.env`. Changing the
authentication hostname later changes the OIDC issuer identity.

## 2. Finish The Cloudflare Domain Prerequisites

- [ ] Wait until the domain appears as **Active** in Cloudflare.
- [ ] Confirm the authoritative nameservers and zone DNS are managed by the
      intended Cloudflare account.
- [ ] Review the imported DNS records and remove or correct stale conflicts for
      the five chosen hostnames.
- [ ] Confirm Cloudflare can issue edge certificates for all five hostnames.
- [ ] Confirm the deployment machine can make outbound connections required by
      `cloudflared`; do not add inbound router or firewall port forwarding.
- [ ] Enable strong MFA for the Cloudflare account and retain recovery access in
      the operator's password manager.

## 3. Create The Cloudflare Tunnel

Use a remotely managed tunnel. The repository already contains the pinned
`cloudflared` Compose service, so do not install a separate system service for
this deployment.

- [ ] In Cloudflare, open **Networking > Tunnels** and create a tunnel named for
      this deployment, for example `virgilio-consultation-v1`.
- [ ] Copy the tunnel token once into the ignored file
      `deploy/consultation-v1/secrets/cloudflare_tunnel_token.txt`.
- [ ] Restrict that file to the deployment operator.
- [ ] Do not put the token itself in `.env`; `.env` contains only
      `CLOUDFLARE_TUNNEL_TOKEN_FILE`.
- [ ] Add the following published-application routes. These service names are
      resolved inside the Compose `edge` network.

| Public hostname | Tunnel service URL |
| --- | --- |
| `virgilio.asiloveit.com` | `http://ui:8080` |
| `api-virgilio.asiloveit.com` | `http://api:8091` |
| `mcp-virgilio.asiloveit.com` | `http://mcp:8092` |
| `auth-virgilio.asiloveit.com` | `http://keycloak:8080` |
| `identity-admin-virgilio.asiloveit.com` | `http://keycloak:8080` |

- [ ] Confirm Cloudflare created proxied DNS records for all published routes.
- [ ] Do not create a public route to `gateway`, either PostgreSQL database, or
      any Docker/host management endpoint.
- [ ] Leave the tunnel stopped until the `.env`, secrets, and local health
      checks are complete.

Cloudflare's current dashboard procedure is documented in
<https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/>.

## 4. Configure Cloudflare Safety Rules

Create a Cache Rule whose action is **Bypass cache** with this expression:

```text
(http.host eq "api-virgilio.asiloveit.com") or
(http.host eq "mcp-virgilio.asiloveit.com") or
(http.host eq "auth-virgilio.asiloveit.com") or
(http.host eq "identity-admin-virgilio.asiloveit.com") or
((http.host eq "virgilio.asiloveit.com") and
 starts_with(http.request.uri.path, "/api/v1/"))
```

This permits the website's versioned static files to use their origin cache
headers while keeping authenticated data, documents, OAuth responses, and MCP
traffic out of Cloudflare's shared cache.

- [ ] Deploy the cache-bypass rule.
- [ ] Check rule ordering so a later rule cannot make these requests cacheable.
- [ ] Do not create a Cache Everything rule for the five service hostnames.
- [ ] If the current Cloudflare plan supports a suitable rate-limit rule, an
      edge limit may be added to `/api/v1/auth/login`. The application limit is
      already mandatory, so this edge rule is optional.
- [ ] Create a Cloudflare Access self-hosted application for only the identity
      administration hostname and restrict it to the owner/operator identity.
- [ ] Do not put Cloudflare Access in front of the public authentication, site,
      API, or MCP hostnames; doing so would add a second authentication protocol
      that can break OIDC and MCP clients.

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

- [ ] Choose the dedicated Google mailbox that will send Consultation V1
      identity email.
- [ ] Confirm 2-Step Verification is enabled for that Google account.
- [x] Revoke the app password previously shared in conversation.
- [x] Generate a new app password at
      <https://myaccount.google.com/apppasswords>.
- [ ] Put only the replacement credential in the ignored file
      `deploy/consultation-v1/secrets/smtp_password.txt`.
- [ ] Record the full mailbox address as the future `SMTP_USER` value.
- [ ] Use the same mailbox for `SMTP_FROM` during initial testing. Use a
      different From address only after Google is configured to permit that
      sender identity.
- [ ] Choose the sender display name; the default is `Virgilio Consultation`.
- [ ] Choose a test recipient controlled by the operator.
- [ ] Record the app-password creation/rotation date in the password manager.

Google notes that app passwords require 2-Step Verification and are revoked
when the Google Account password changes. See
<https://support.google.com/accounts/answer/185833>.

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
| `AUTH_ADMIN_PUBLIC_URL` | `https://identity-admin-virgilio.asiloveit.com` |
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

- [ ] The Cloudflare zone is Active.
- [x] The five exact hostnames are recorded.
- [ ] The remotely managed tunnel and five routes exist.
- [ ] The tunnel token is present only in its ignored secret file.
- [ ] Cache bypass and identity-admin Access rules are configured.
- [ ] No direct public origin port or gateway/database route exists.
- [ ] The replacement Google app password is present only in its ignored secret
      file.
- [ ] SMTP username, From address, and display name are recorded.
- [ ] No secret value appears in `.env`, Git, this document, or operational
      notes.

After this gate passes, complete `deploy/consultation-v1/.env`, validate the
Compose rendering, start the unexposed services, test Keycloak email, and only
then start the `publish` profile.
