import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getWorkspaceRoot, withClient } from "./processing-common.mjs";

const MIGRATION = path.join(
  getWorkspaceRoot(),
  "db",
  "migrations",
  "2026-09-03-010-reference-observations-and-text-search.sql",
);

async function main() {
  const sql = await fs.readFile(MIGRATION, "utf8");
  await withClient("reference-search-migration", async (client) => {
    await client.query(sql);
  });
  console.log(`Applied ${path.basename(MIGRATION)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
