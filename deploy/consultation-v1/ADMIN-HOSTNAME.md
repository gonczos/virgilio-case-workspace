# Protected Keycloak administration

Status: prepared, not activated or verified live.
Target: `https://admin-auth-virgilio.asiloveit.com` through the existing Tunnel.
Public authentication remains `https://auth-virgilio.asiloveit.com`.

## Ordered activation

1. Create a Cloudflare Access self-hosted application for the entire admin
   hostname, without a path restriction. Allow only the operator's confirmed
   exact email. No Everyone or Bypass policy. Authenticate through an independent
   identity provider or Cloudflare email OTP, not this Keycloak, to avoid circular
   authentication. Retain Keycloak administrator TOTP.
2. Add the existing Tunnel's published application route for that hostname to
   `http://keycloak:8080`, with proxied DNS. Add the admin hostname to cache bypass.
   Keep public auth's `/admin` and `/realms/master` blocking rule. Do not apply
   Access to public site/API/MCP/authentication hostnames.
3. Verify anonymous requests to the admin host's `/admin/` and `/realms/master/`
   receive an Access challenge, and the allowed operator can pass Access. Stop
   if any admin-host path bypasses Access. Keycloak login may still redirect to
   the blocked public host until the remaining steps are complete.
4. Enter the documented local maintenance mode and log in as the permanent
   master administrator. Record the current master Realm settings > General >
   Frontend URL, then change it to `https://admin-auth-virgilio.asiloveit.com`.
   Change only master, not consultation. Save this as the last local UI operation:
   subsequent master logins will use the protected hostname.
5. Add this setting to the deployment `.env`:

   ```dotenv
   KEYCLOAK_ADMIN_URL=https://admin-auth-virgilio.asiloveit.com
   ```

   From the repository root, recreate Keycloak with the base file only:

   ```powershell
   docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml up -d --no-deps --force-recreate keycloak
   docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml ps keycloak
   ```

   Wait for healthy state, then restore the Tunnel:

   ```powershell
   docker compose --env-file deploy/consultation-v1/.env -f deploy/consultation-v1/compose.yml --profile publish up -d cloudflared
   ```

This uses one final bounded maintenance window. Routine administration afterwards
does not require stopping public ingress or restarting Keycloak.

## Acceptance

- A fresh session must pass Access before reaching any path on the admin host.
- The allowed operator logs into `/admin/master/console/` with the permanent
  master account and TOTP and can view both realms and users.
- Master login, token requests, and admin API calls stay on the protected host;
  static resources load without Access or CORS failures.
- A non-allowed identity cannot reach Keycloak through that hostname.
- Public auth still blocks `/admin/` and `/realms/master/`.
- Consultation discovery still advertises the original issuer; fresh public
  website login and existing MCP authentication work.
- No host port is published. A healthy container alone does not pass acceptance.

## Rollback and recovery

While authenticated as the permanent administrator, restore master's previous
Frontend URL (normally blank) before removing the protected route. Remove
`KEYCLOAK_ADMIN_URL` from `.env` and recreate Keycloak using the base file. The
original local maintenance procedure is usable again. Remove Tunnel/DNS routing
before removing Access protection.

If browser login fails, retain the protected route and use authenticated
Keycloak Admin CLI/API access from the deployment host to restore master's
`attributes.frontendUrl`. This requires the permanent administrator's credentials
and OTP where required. Do not use the deleted bootstrap account or direct
database edits. Applying `compose.admin-local.yml` alone cannot clear the
persistent realm frontend URL and will not restore local master login.

## Separate onboarding issue

`Send-VerificationEmail.ps1` still authenticates as the deleted `bootstrap-admin`.
It needs a separate permanent, appropriately scoped authentication mechanism.
No invitation emails are sent as part of this rollout.

## References

- [Keycloak hostname configuration](https://www.keycloak.org/server/hostname)
- [Pinned hostname implementation](https://github.com/keycloak/keycloak/blob/26.7.3/services/src/main/java/org/keycloak/url/HostnameV2Provider.java)
- [Cloudflare Access setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
