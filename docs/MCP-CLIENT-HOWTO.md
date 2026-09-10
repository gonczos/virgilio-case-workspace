# Connect to Virgilio Consultation

Client guide · beta v1 · 10 September 2026

Use this guide to connect ChatGPT or Codex to the hosted Virgilio document service. Choose the application you use; you do not need both. The connection provides read-only tools for consulting the corpus.

## Before you begin

- Have your own invited Virgilio account. Complete password setup, email verification and authenticator enrollment first. Check that you can sign in at [Virgilio Consultation](https://virgilio.asiloveit.com).
- Use your own account and authenticator codes. The application registration does not replace your personal login.
- You need an internet connection. You do not need Docker, the project repository, a database or local copies of the documents.

The common server address is:

```text
https://mcp-virgilio.asiloveit.com/mcp/v1
```

| | ChatGPT in your browser | Codex on your computer |
|---|---|---|
| Connection name in this guide | Virgilio Consultation | virgilio-hosted |
| Application client ID | consultation-chatgpt | consultation-codex |
| Application secret | Supplied separately by the administrator | None |
| Personal login | Your Virgilio account | Your Virgilio account |
| Repeat setup on another computer? | Use your ChatGPT account's configured plugin where available | Yes: configure and log in on each computer |

## Option A: ChatGPT

### 1. Enable Developer mode

Use ChatGPT on the web with an eligible plan. Plus is supported; Pro is not required. Open **Settings → Security and login → Developer mode** and enable it. Interface labels can change. These steps follow the current [OpenAI Developer mode documentation](https://developers.openai.com/api/docs/guides/developer-mode).

### 2. Create the plugin

Open **Plugins**, select **+**, and create a plugin with these values:

| Field | Value |
|---|---|
| Name | Virgilio Consultation |
| Description | Read-only consultation of the Virgilio case corpus |
| Connection | Server URL |
| Server URL | `https://mcp-virgilio.asiloveit.com/mcp/v1` |
| Authentication | OAuth |
| Advanced OAuth settings → Registration method | **User-Defined OAuth Client** |
| Client ID | `consultation-chatgpt` |
| Client Secret | Paste the value supplied privately by the Virgilio administrator |

Do not choose Dynamic Client Registration (DCR): this service does not allow anonymous client registration. Do not paste your personal password into the Client Secret field. Do not put the application secret into a conversation or screenshot.

The registered callback is `https://chatgpt.com/connector_platform_oauth_redirect`. If ChatGPT shows a different callback, ask the administrator to configure that exact URL before proceeding. See [OpenAI's callback guidance](https://developers.openai.com/plugins/build/auth#redirect-url).

ChatGPT may request `openid offline_access consultation.read` automatically. The server is configured to accept these scopes for this client; you do not need to find an editable scope field.

### 3. Sign in and select the plugin

Save/create the plugin and complete the authorization when ChatGPT offers it. Sign in on `auth-virgilio.asiloveit.com`, enter your authenticator code if requested, and approve the access request.

Start a new conversation and select **Virgilio Consultation** through the composer's plugin/Developer mode controls. Creating the plugin does not necessarily select it in every conversation. If you chose another name, use that name in the test below.

### 4. Test the connection

Send:

> Use the Virgilio Consultation plugin to call its `hello` tool. Report the actual tool result, not an answer from memory.

Success means an actual tool call completed and identified the service. The `hello` tool does not access case data. A statement such as “I can connect” alone is not a test.

Then try:

> Use Virgilio Consultation to search document text for `105398957`. Return at most three results with their source references.

## Option B: Codex

### 1. Prepare Codex

Use a current Codex installation with the `codex` command available in its terminal. If `codex --version` is not recognised, ask the administrator to help install/configure the Codex CLI before continuing. No separate PKCE software is needed.

### 2. Add the connection settings

Open your **user** Codex configuration file:

- Windows: `%USERPROFILE%\.codex\config.toml` (normally `C:\Users\YOUR-NAME\.codex\config.toml`).
- macOS/Linux: `~/.codex/config.toml`.

If you use a custom `CODEX_HOME`, use its `config.toml` instead. Add the following at the end. Preserve existing settings; if a `virgilio-hosted` section already exists, update it rather than adding a duplicate.

```toml
[mcp_servers.virgilio-hosted]
url = "https://mcp-virgilio.asiloveit.com/mcp/v1"
scopes = ["openid", "consultation.read"]

[mcp_servers.virgilio-hosted.oauth]
client_id = "consultation-codex"
callback_url = "http://127.0.0.1:8787/callback"
callback_port = 8787
```

This client has already been registered by the administrator. No client secret is needed. PKCE automatically protects the login handoff. The callback is a temporary local listener on your computer, not the hosted server and not a page to open manually. Port 8787 must be free during login.

Do not add an `oauth_resource` setting: Codex discovers the resource automatically. Explicitly adding it caused a duplicate parameter in the CLI tested for this deployment. The configuration fields are described in [OpenAI's Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

### 3. Log in

In a terminal on the **same computer**, run:

```sh
codex mcp login virgilio-hosted --scopes openid,consultation.read
```

Keep the terminal running. Complete login and consent in the browser on that computer. If the browser does not open, use the authorization link printed by the command. Do not send the link to another person or open it on another computer.

Wait for:

```text
Successfully logged in to MCP server 'virgilio-hosted'.
```

Check the saved connection with:

```sh
codex mcp list
```

It should show `virgilio-hosted`, the hosted URL, status `enabled`, and authentication `OAuth`. This confirms configuration and saved authorization; the next step verifies a tool call.

### 4. Load and test the tools

Restart Codex and open a new task. Send:

> Use `virgilio-hosted` to call its `hello` tool. Report the actual tool result. Do not use a local Virgilio server or another plugin instead.

Then try the document-text search from the ChatGPT section, naming `virgilio-hosted` instead. The hosted service currently exposes `hello`, `search_document_text`, `query_court_records`, `get_binary_details` and `get_representation_content`; it does not expose a dedicated `list_cases` tool.

### Another computer

Repeat steps 1–4 there, using the same configuration and your own Virgilio login. You do not need another Keycloak client registration. Do not copy OAuth credentials between computers. Configuring ChatGPT does not automatically configure Codex, and configuring Codex on one computer does not configure the others.

## Sign out and revoke access

**Virgilio website:** select **Log out**, then complete the identity-provider confirmation. This ends that browser's website/login session.

**Codex on this computer:** run:

```sh
codex mcp logout virgilio-hosted
```

This removes Codex's saved authorization; it is not a global logout of other computers or the browser's SSO session. To remove the saved connection as well, run `codex mcp remove virgilio-hosted`. On a shared computer, also log out of the Virgilio website/identity provider and close document tabs.

**ChatGPT:** use the plugin's disconnect/remove controls where available. Its approved offline grant can survive website logout. To revoke the server-side grant, use the applications area in the [Virgilio account console](https://auth-virgilio.asiloveit.com/realms/consultation/account/) or ask the administrator to revoke the ChatGPT consent/offline session.

The ChatGPT grant has a 30-minute idle timeout and an eight-hour absolute maximum; automatic refresh activity can keep it from being idle. Codex uses standard sessions, with no offline access. Access tokens last up to five minutes, so a token already issued may remain usable briefly after grant revocation. Reauthorize when prompted; do not share passwords or tokens to avoid login.

## Troubleshooting

| Symptom | What to do |
|---|---|
| “Trusted Hosts” / registration 403 | In ChatGPT, choose **User-Defined OAuth Client**, with the supplied ID and secret. |
| “Invalid scopes” | Send the exact error to the administrator. The ChatGPT client must allow its automatic offline-access request; clients should not need to edit hidden scope fields. |
| “Invalid redirect URI” | Confirm the callback matches this guide. Send the administrator the callback address, excluding any authorization code or token. |
| Codex reports a duplicated parameter | Remove an explicit `oauth_resource` entry for this connection and retry login. |
| Local callback cannot connect / port in use | Run login again on the same computer as the browser. Keep the command running; ask for help if port 8787 is occupied. Do not change only the port: the client registration and configuration must match. |
| “Tools unavailable in this conversation” | Check plugin selection in ChatGPT. In Codex, check `codex mcp list`, restart Codex and start a new task. Successful login and available tools are separate checks. |
| A differently named Virgilio plugin appears | Verify its configured server URL. A display name alone does not establish that it is this hosted connection. |
| “No case-listing tool” | Test `hello`, then `search_document_text` or `query_court_records`; do not assume a `list_cases` tool exists. |
| Login succeeded but tool calls return 401/403 | Reauthorize; if it persists, ask the administrator to check your consultation role, token scope and audience. |
| Service unreachable | Ask whether the server is running or in maintenance mode. A local browser-cache reset cannot fix a stopped server. |

For help, include the application, setup step, time and exact error, or a screenshot with sensitive fields removed. Never send passwords, MFA codes, client secrets, access/refresh tokens or complete authentication callback URLs.

## Verification note

This guide follows the deployed client configuration and official documentation checked on 10 September 2026. Codex login was confirmed on the setup computer. Each new installation should complete the `hello` test; a successful test on one computer does not verify every user's connection. Product menus may change.
