import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const requiredRelativePaths = [
  "package.json",
  path.join("cases", "cases.jsonl"),
  path.join("cases", "buckets.jsonl"),
  path.join("cases", "documents.jsonl"),
  path.join("cases", "bucket_documents.jsonl"),
  path.join("cases", "file_binaries.jsonl"),
  path.join("cases", "document_binaries.jsonl"),
];

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

function toNullableInt(value) {
  const text = normalizeText(value);
  if (text === null) {
    return null;
  }
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Expected numeric value, received: ${value}`);
  }
  return Math.trunc(numeric);
}

function toNullableBoolean(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(text)) return true;
  if (["false", "0", "no"].includes(text)) return false;
  throw new Error(`Expected boolean value, received: ${value}`);
}

function toNullableDate(value) {
  const text = normalizeText(value);
  return text;
}

function toNullableTimestamp(value) {
  const text = normalizeText(value);
  return text;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function loadDotEnv(envPath) {
  if (!fsSync.existsSync(envPath)) {
    return;
  }
  const content = fsSync.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getPackagePath() {
  const candidate = process.argv[2];
  if (!candidate) {
    throw new Error("Usage: npm run import:package -- data/imports/<package-dir>");
  }
  return path.resolve(candidate);
}

async function assertPackageShape(packageDir) {
  for (const relativePath of requiredRelativePaths) {
    const absolutePath = path.join(packageDir, relativePath);
    if (!await pathExists(absolutePath)) {
      throw new Error(`Required package file missing: ${absolutePath}`);
    }
  }
}

async function withTransaction(client, work) {
  await client.query("BEGIN");
  try {
    const result = await work();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function upsertImportBatch(client, manifest) {
  const result = await client.query(
    `
      INSERT INTO casework.import_batch (
        package_id,
        package_kind,
        source_system,
        schema_version,
        producer,
        created_at_source,
        case_count,
        document_count,
        file_binary_count,
        package_metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (package_id) DO UPDATE
      SET
        package_kind = EXCLUDED.package_kind,
        source_system = EXCLUDED.source_system,
        schema_version = EXCLUDED.schema_version,
        producer = EXCLUDED.producer,
        created_at_source = EXCLUDED.created_at_source,
        case_count = EXCLUDED.case_count,
        document_count = EXCLUDED.document_count,
        file_binary_count = EXCLUDED.file_binary_count,
        package_metadata_json = EXCLUDED.package_metadata_json
      RETURNING id
    `,
    [
      manifest.package_id,
      manifest.package_kind,
      manifest.source_system,
      manifest.schema_version,
      normalizeText(manifest.producer),
      toNullableTimestamp(manifest.created_at),
      toNullableInt(manifest.case_count),
      toNullableInt(manifest.document_count),
      toNullableInt(manifest.file_binary_count),
      JSON.stringify(manifest),
    ],
  );
  return result.rows[0].id;
}

async function upsertCourt(client, row) {
  const result = await client.query(
    `
      INSERT INTO casework.court (
        country_id,
        source_system,
        tribunal_name,
        unit_name,
        idtribref,
        idunorgref,
        idcliente,
        canonical_confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (source_system, idtribref, idunorgref, idcliente) DO UPDATE
      SET
        country_id = EXCLUDED.country_id,
        tribunal_name = EXCLUDED.tribunal_name,
        unit_name = EXCLUDED.unit_name,
        canonical_confidence = EXCLUDED.canonical_confidence,
        updated_at = NOW()
      RETURNING id
    `,
    [
      normalizeText(row.country_id) ?? "PT",
      row.source_system,
      row.tribunal_name,
      normalizeText(row.unit_name),
      normalizeText(row.idtribref),
      normalizeText(row.idunorgref),
      normalizeText(row.idcliente),
      row.canonical_confidence,
    ],
  );
  return result.rows[0].id;
}

async function upsertCaseFile(client, row, courtId) {
  const result = await client.query(
    `
      INSERT INTO casework.case_file (
        court_id,
        source_system,
        processo,
        idprocesso,
        especie,
        estado,
        data_autuacao,
        data_decisao,
        is_base_case,
        case_scope_status,
        canonical_confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (source_system, processo) DO UPDATE
      SET
        court_id = EXCLUDED.court_id,
        idprocesso = EXCLUDED.idprocesso,
        especie = EXCLUDED.especie,
        estado = EXCLUDED.estado,
        data_autuacao = EXCLUDED.data_autuacao,
        data_decisao = EXCLUDED.data_decisao,
        is_base_case = EXCLUDED.is_base_case,
        case_scope_status = EXCLUDED.case_scope_status,
        canonical_confidence = EXCLUDED.canonical_confidence,
        updated_at = NOW()
      RETURNING id
    `,
    [
      courtId,
      row.source_system,
      row.processo,
      normalizeText(row.idprocesso),
      normalizeText(row.especie),
      normalizeText(row.estado),
      toNullableDate(row.data_autuacao),
      toNullableDate(row.data_decisao),
      Boolean(toNullableBoolean(row.is_base_case)),
      row.case_scope_status,
      row.canonical_confidence,
    ],
  );
  return result.rows[0].id;
}

async function setParentCaseFile(client, row) {
  const parentProcesso = normalizeText(row.parent_processo);
  if (!parentProcesso) {
    return;
  }
  await client.query(
    `
      UPDATE casework.case_file AS child
      SET
        parent_case_file_id = parent.id,
        updated_at = NOW()
      FROM casework.case_file AS parent
      WHERE child.source_system = $1
        AND child.processo = $2
        AND parent.source_system = $1
        AND parent.processo = $3
    `,
    [row.source_system, row.processo, parentProcesso],
  );
}

async function upsertBucket(client, row, caseFileId) {
  const result = await client.query(
    `
      INSERT INTO casework.bucket (
        case_file_id,
        source_system,
        bucket_id,
        reference_number,
        bucket_date,
        designation,
        presenter,
        modal_title,
        document_count,
        displayed_bucket_size_bytes,
        canonical_confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (case_file_id, bucket_id) DO UPDATE
      SET
        reference_number = EXCLUDED.reference_number,
        bucket_date = EXCLUDED.bucket_date,
        designation = EXCLUDED.designation,
        presenter = EXCLUDED.presenter,
        modal_title = EXCLUDED.modal_title,
        document_count = EXCLUDED.document_count,
        displayed_bucket_size_bytes = EXCLUDED.displayed_bucket_size_bytes,
        canonical_confidence = EXCLUDED.canonical_confidence,
        updated_at = NOW()
      RETURNING id
    `,
    [
      caseFileId,
      row.source_system,
      String(row.bucket_id),
      normalizeText(row.reference_number),
      toNullableDate(row.bucket_date),
      normalizeText(row.designation),
      normalizeText(row.presenter),
      normalizeText(row.modal_title),
      toNullableInt(row.document_count),
      toNullableInt(row.displayed_bucket_size_bytes),
      row.canonical_confidence,
    ],
  );
  return result.rows[0].id;
}

async function upsertDocument(client, row) {
  const result = await client.query(
    `
      INSERT INTO casework.document (
        source_system,
        document_procinfo,
        document_name,
        document_anchor_title,
        document_date,
        document_type,
        document_type_from_attr,
        claimed_size_bytes,
        canonical_confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (source_system, document_procinfo, document_name, document_date, document_type, claimed_size_bytes) DO UPDATE
      SET
        document_anchor_title = EXCLUDED.document_anchor_title,
        document_type_from_attr = EXCLUDED.document_type_from_attr,
        canonical_confidence = EXCLUDED.canonical_confidence,
        updated_at = NOW()
      RETURNING id
    `,
    [
      row.source_system,
      normalizeText(row.document_procinfo),
      normalizeText(row.document_name),
      normalizeText(row.document_anchor_title),
      toNullableDate(row.document_date),
      normalizeText(row.document_type),
      normalizeText(row.document_type_from_attr),
      toNullableInt(row.claimed_size_bytes),
      row.canonical_confidence,
    ],
  );
  return result.rows[0].id;
}

async function upsertBucketDocument(client, bucketId, documentId, row) {
  await client.query(
    `
      INSERT INTO casework.bucket_document (
        bucket_id,
        document_id,
        source_observation_count,
        has_intra_bucket_duplication,
        canonical_confidence
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (bucket_id, document_id) DO UPDATE
      SET
        source_observation_count = EXCLUDED.source_observation_count,
        has_intra_bucket_duplication = EXCLUDED.has_intra_bucket_duplication,
        canonical_confidence = EXCLUDED.canonical_confidence,
        updated_at = NOW()
    `,
    [
      bucketId,
      documentId,
      toNullableInt(row.source_observation_count) ?? 1,
      Boolean(toNullableBoolean(row.has_intra_bucket_duplication)),
      row.canonical_confidence,
    ],
  );
}

async function upsertFileBinary(client, row) {
  const result = await client.query(
    `
      INSERT INTO casework.file_binary (
        sha256,
        actual_size_bytes,
        mime_type,
        file_extension,
        storage_package_id,
        storage_rel_path,
        retention_status,
        integrity_check_status,
        integrity_checked_at,
        integrity_checker,
        machine_readability_status,
        machine_readability_checked_at,
        page_count,
        pages_with_text,
        pages_without_text,
        text_coverage_ratio,
        total_extracted_characters,
        page_text_report_json,
        canonical_confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19)
      ON CONFLICT (sha256) DO UPDATE
      SET
        actual_size_bytes = EXCLUDED.actual_size_bytes,
        mime_type = EXCLUDED.mime_type,
        file_extension = EXCLUDED.file_extension,
        storage_package_id = EXCLUDED.storage_package_id,
        storage_rel_path = EXCLUDED.storage_rel_path,
        retention_status = EXCLUDED.retention_status,
        integrity_check_status = EXCLUDED.integrity_check_status,
        integrity_checked_at = EXCLUDED.integrity_checked_at,
        integrity_checker = EXCLUDED.integrity_checker,
        machine_readability_status = EXCLUDED.machine_readability_status,
        machine_readability_checked_at = EXCLUDED.machine_readability_checked_at,
        page_count = EXCLUDED.page_count,
        pages_with_text = EXCLUDED.pages_with_text,
        pages_without_text = EXCLUDED.pages_without_text,
        text_coverage_ratio = EXCLUDED.text_coverage_ratio,
        total_extracted_characters = EXCLUDED.total_extracted_characters,
        page_text_report_json = EXCLUDED.page_text_report_json,
        canonical_confidence = EXCLUDED.canonical_confidence,
        updated_at = NOW()
      RETURNING id
    `,
    [
      row.sha256,
      toNullableInt(row.actual_size_bytes),
      normalizeText(row.mime_type),
      normalizeText(row.file_extension),
      normalizeText(row.storage_package_id),
      normalizeText(row.storage_rel_path),
      row.retention_status,
      normalizeText(row.integrity_check_status),
      toNullableTimestamp(row.integrity_checked_at),
      normalizeText(row.integrity_checker),
      normalizeText(row.machine_readability_status),
      toNullableTimestamp(row.machine_readability_checked_at),
      toNullableInt(row.page_count),
      toNullableInt(row.pages_with_text),
      toNullableInt(row.pages_without_text),
      row.text_coverage_ratio === null || row.text_coverage_ratio === undefined || row.text_coverage_ratio === "" ? null : Number(row.text_coverage_ratio),
      toNullableInt(row.total_extracted_characters),
      JSON.stringify(row.page_text_report_json ?? null),
      row.canonical_confidence,
    ],
  );
  return result.rows[0].id;
}

async function upsertDocumentBinary(client, documentId, fileBinaryId, row) {
  await client.query(
    `
      INSERT INTO casework.document_binary (
        document_id,
        file_binary_id,
        source_observation_count,
        is_primary,
        match_confidence
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (document_id, file_binary_id) DO UPDATE
      SET
        source_observation_count = EXCLUDED.source_observation_count,
        is_primary = EXCLUDED.is_primary,
        match_confidence = EXCLUDED.match_confidence,
        updated_at = NOW()
    `,
    [
      documentId,
      fileBinaryId,
      toNullableInt(row.source_observation_count) ?? 1,
      Boolean(toNullableBoolean(row.is_primary)),
      row.match_confidence,
    ],
  );
}

async function main() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(moduleDir, "..");
  loadDotEnv(path.join(workspaceRoot, ".env"));

  const packageDir = getPackagePath();
  await assertPackageShape(packageDir);

  const manifest = await readJson(path.join(packageDir, "package.json"));
  const caseRows = await readJsonl(path.join(packageDir, "cases", "cases.jsonl"));
  const bucketRows = await readJsonl(path.join(packageDir, "cases", "buckets.jsonl"));
  const documentRows = await readJsonl(path.join(packageDir, "cases", "documents.jsonl"));
  const bucketDocumentRows = await readJsonl(path.join(packageDir, "cases", "bucket_documents.jsonl"));
  const fileBinaryRows = await readJsonl(path.join(packageDir, "cases", "file_binaries.jsonl"));
  const documentBinaryRows = await readJsonl(path.join(packageDir, "cases", "document_binaries.jsonl"));

  const client = new Client({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.POSTGRES_DB ?? process.env.PGDATABASE,
    user: process.env.POSTGRES_USER ?? process.env.PGUSER,
    password: process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD,
  });
  await client.connect();

  try {
    await withTransaction(client, async () => {
      await upsertImportBatch(client, manifest);

      const caseIdByProcesso = new Map();
      const bucketIdByCaseAndBucket = new Map();
      const documentIdByKey = new Map();
      const fileBinaryIdBySha = new Map();

      for (const row of caseRows) {
        const courtId = await upsertCourt(client, row);
        const caseFileId = await upsertCaseFile(client, row, courtId);
        caseIdByProcesso.set(row.processo, caseFileId);
      }

      for (const row of caseRows) {
        await setParentCaseFile(client, row);
      }

      for (const row of bucketRows) {
        const caseFileId = caseIdByProcesso.get(row.processo);
        if (!caseFileId) {
          throw new Error(`Bucket references unknown processo: ${row.processo}`);
        }
        const bucketRowId = await upsertBucket(client, row, caseFileId);
        bucketIdByCaseAndBucket.set(`${row.processo}|${row.bucket_id}`, bucketRowId);
      }

      for (const row of documentRows) {
        const documentKey = normalizeText(row.document_key);
        if (!documentKey) {
          throw new Error("Document row missing document_key");
        }
        const documentId = await upsertDocument(client, row);
        documentIdByKey.set(documentKey, documentId);
      }

      for (const row of bucketDocumentRows) {
        const bucketRowId = bucketIdByCaseAndBucket.get(`${row.processo}|${row.bucket_id}`);
        const documentId = documentIdByKey.get(row.document_key);
        if (!bucketRowId) {
          throw new Error(`Bucket-document references unknown bucket: ${row.processo} / ${row.bucket_id}`);
        }
        if (!documentId) {
          throw new Error(`Bucket-document references unknown document_key: ${row.document_key}`);
        }
        await upsertBucketDocument(client, bucketRowId, documentId, row);
      }

      for (const row of fileBinaryRows) {
        row.storage_package_id = manifest.package_id;
        const fileBinaryId = await upsertFileBinary(client, row);
        fileBinaryIdBySha.set(row.sha256, fileBinaryId);
      }

      for (const row of documentBinaryRows) {
        const documentId = documentIdByKey.get(row.document_key);
        const fileBinaryId = fileBinaryIdBySha.get(row.sha256);
        if (!documentId) {
          throw new Error(`Document-binary references unknown document_key: ${row.document_key}`);
        }
        if (!fileBinaryId) {
          throw new Error(`Document-binary references unknown sha256: ${row.sha256}`);
        }
        await upsertDocumentBinary(client, documentId, fileBinaryId, row);
      }
    });
  } finally {
    await client.end();
  }

  console.log(`[import] package imported: ${manifest.package_id}`);
  console.log(`[import] package dir: ${packageDir}`);
  console.log(`[import] cases: ${caseRows.length}`);
  console.log(`[import] buckets: ${bucketRows.length}`);
  console.log(`[import] documents: ${documentRows.length}`);
  console.log(`[import] bucket-document links: ${bucketDocumentRows.length}`);
  console.log(`[import] file binaries: ${fileBinaryRows.length}`);
  console.log(`[import] document-binary links: ${documentBinaryRows.length}`);
}

main().catch((error) => {
  console.error("[import] fatal error");
  console.error(error);
  process.exitCode = 1;
});
