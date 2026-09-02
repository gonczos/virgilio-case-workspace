import path from "node:path";

import { getWorkspaceRoot, loadDotEnv } from "../app/processing-common.mjs";

loadDotEnv(path.join(getWorkspaceRoot(), ".env"));
const baseUrl = "http://127.0.0.1:8055";
const login = await fetch(`${baseUrl}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: process.env.DIRECTUS_ADMIN_EMAIL,
    password: process.env.DIRECTUS_ADMIN_PASSWORD,
  }),
});
if (!login.ok) throw new Error(`Directus login failed: ${login.status}`);
const token = (await login.json()).data.access_token;
const response = await fetch(`${baseUrl}/collections`, {
  headers: { authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`Directus collections failed: ${response.status}`);
const payload = await response.json();
const collections = payload.data
  .map((item) => item.collection)
  .filter((name) => !name.startsWith("directus_"))
  .sort();
process.stdout.write(JSON.stringify({ collections }, null, 2));
