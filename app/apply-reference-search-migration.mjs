import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getWorkspaceRoot, withClient } from "./processing-common.mjs";

const MIGRATIONS = [
  "2026-09-03-010-reference-observations-and-text-search.sql",
  "2026-09-03-011-reference-observation-reviews.sql",
  "2026-09-03-012-reference-resolution-state.sql",
  "2026-09-03-013-reference-metadata-lifecycle.sql",
];

async function main() {
  await withClient("reference-search-migration", async (client) => {
    for (const filename of MIGRATIONS) {
      const migration = path.join(getWorkspaceRoot(), "db", "migrations", filename);
      await client.query(await fs.readFile(migration, "utf8"));
      console.log(`Applied ${filename}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
