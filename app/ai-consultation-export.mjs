import fs from "node:fs/promises";
import path from "node:path";

import { inspectFactualExport } from "./factual-export-inspect.mjs";

const README = `# Court case document package

This folder contains original court-case documents and machine-readable versions that can help an AI locate, summarize, compare, and cite information.

Start with \`documents.csv\`. Each row points to a directory named with the document binary's full SHA-256. That directory contains the original file, concise source metadata, and the extracted content available for consultation.

## Guidance for consulting this package with AI

1. Start with \`documents.csv\`.
2. Use each document's \`metadata.json\` to identify procedural occurrences and case context.
3. Treat the original binary as the canonical evidence object.
4. Treat extracted content as processor-attributed derived evidence, not as the original.
5. Do not silently merge, reconcile, or select between processor outputs.
6. When outputs disagree, report the disagreement and consult the original binary.
7. Cite conclusions using the full SHA-256, source document metadata, and PDF page where available.
8. Do not infer that repeated procedural occurrences represent distinct documents.
9. Distinguish factual extraction from legal, semantic, or narrative interpretation.

## Folder contents

- \`original.*\`: the original document.
- \`evidence/\`: literal text and narrow PDF observations such as signatures or structure.
- \`interpretations/\`: readable content produced by document extraction tools.
- \`warnings.md\`: important disagreements or extraction cautions, when present.

Machine extraction and AI answers can be incomplete or wrong. Check important conclusions against the original document. This package may contain sensitive personal and court-case information; keep it private.
`;

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(columns, rows) {
  return `${[columns.join(","), ...rows.map((row) => columns.map((key) => csvValue(row[key])).join(","))].join("\n")}\n`;
}

async function assertNewDirectory(outputDir) {
  try {
    await fs.access(outputDir);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Output directory already exists: ${outputDir}`);
}

async function copyIfUseful(source, target) {
  const stats = await fs.stat(source);
  if (stats.size === 0) return false;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  return true;
}

function sourceContext(manifest) {
  const persisted = manifest.persisted;
  const documents = new Map(persisted.documents.map((row) => [row.id, row]));
  const buckets = new Map(persisted.buckets.map((row) => [row.id, row]));
  const cases = new Map(persisted.case_files.map((row) => [row.id, row]));
  const memberships = new Map();
  for (const row of persisted.bucket_documents) {
    const list = memberships.get(row.document_id) ?? [];
    list.push(row);
    memberships.set(row.document_id, list);
  }
  return persisted.document_binaries.map((link) => {
    const document = documents.get(link.document_id) ?? {};
    const occurrences = (memberships.get(link.document_id) ?? []).map((membership) => {
      const bucket = buckets.get(membership.bucket_id) ?? {};
      const caseFile = cases.get(bucket.case_file_id) ?? {};
      return {
        source_system: bucket.source_system ?? document.source_system ?? null,
        process_number: caseFile.processo ?? null,
        source_bucket_id: bucket.bucket_id ?? null,
        reference_number: bucket.reference_number ?? null,
        bucket_date: bucket.bucket_date ?? null,
        designation: bucket.designation ?? null,
        presenter: bucket.presenter ?? null,
      };
    });
    return {
      source_system: document.source_system ?? null,
      document_reference: document.document_procinfo ?? null,
      document_name: document.document_name ?? null,
      document_date: document.document_date ?? null,
      document_type: document.document_type ?? null,
      claimed_size_bytes: document.claimed_size_bytes ?? null,
      is_primary_binary: Boolean(link.is_primary),
      occurrences,
    };
  });
}

const OUTPUTS = {
  pdf_literal_text: { source: "text.txt", target: "evidence/literal-text.txt" },
  pdf_signature_metadata: { source: "native.json", target: "evidence/signatures.json" },
  pdf_structure_inventory: { source: "native.json", target: "evidence/pdf-structure.json" },
  xberg: { source: "complete-text.txt", target: "interpretations/xberg.txt" },
  docling: { source: "markdown.md", target: "interpretations/docling.md" },
};

function preferredRepresentations(manifest, artifacts) {
  const selected = new Map();
  for (const representation of manifest.persisted.document_representations) {
    const output = OUTPUTS[representation.processor_key];
    const artifact = artifacts.get(representation.id);
    if (!output || !artifact) continue;
    const size = artifact.copied_files.find((file) => file.relativePath === output.source)?.sizeBytes ?? 0;
    const current = selected.get(representation.processor_key);
    if (!current || size > current.size || (size === current.size && new Date(representation.created_at) > new Date(current.representation.created_at))) {
      selected.set(representation.processor_key, { representation, size });
    }
  }
  return new Map([...selected].map(([processor, value]) => [processor, value.representation]));
}

export async function prepareAiConsultationPackage({ sourcePackageDir, outputDir }) {
  await inspectFactualExport({ packageDir: sourcePackageDir });
  await assertNewDirectory(outputDir);
  const factual = JSON.parse(await fs.readFile(path.join(sourcePackageDir, "manifest.json"), "utf8"));
  const indexRows = [];
  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, "README.md"), README, "utf8");
    for (const binaryEntry of factual.binaries) {
      const sha256 = binaryEntry.sha256;
      const sourceRoot = path.join(sourcePackageDir, path.dirname(binaryEntry.portable_manifest_path));
      const manifest = JSON.parse(await fs.readFile(path.join(sourceRoot, "manifest.json"), "utf8"));
      const targetRoot = path.join(outputDir, "documents", sha256);
      await fs.mkdir(targetRoot, { recursive: true });
      const original = manifest.package_contents.original_binary;
      const extension = path.extname(original.package_path) || ".bin";
      await fs.copyFile(path.join(sourceRoot, original.package_path), path.join(targetRoot, `original${extension}`));

      const artifacts = new Map(manifest.package_contents.representation_artifacts.map((row) => [row.representation_id, row]));
      const representations = preferredRepresentations(manifest, artifacts);
      const available = [];
      for (const [processor, output] of Object.entries(OUTPUTS)) {
        const representation = representations.get(processor);
        const artifact = representation ? artifacts.get(representation.id) : null;
        if (!representation || !artifact) continue;
        const copied = await copyIfUseful(path.join(sourceRoot, artifact.package_dir, output.source), path.join(targetRoot, output.target))
          .catch((error) => {
            if (error?.code === "ENOENT") return false;
            throw error;
          });
        if (copied) available.push({
          kind: representation.representation_kind,
          processor: representation.processor_key,
          processor_version: representation.processor_version,
          path: output.target,
        });
      }

      const selectedRepresentationIds = new Set([...representations.values()].map((row) => row.id));
      const disagreements = manifest.persisted.document_representation_comparisons
        .filter((row) => selectedRepresentationIds.has(row.representation_a_id) && selectedRepresentationIds.has(row.representation_b_id))
        .filter((row) => row.summary_json?.disagreement_level && row.summary_json.disagreement_level !== "none")
        .map((row) => ({
          processors: row.summary_json.labels ?? [],
          level: row.summary_json.disagreement_level,
          first_different_line: row.summary_json.first_different_line ?? null,
        }));
      if (disagreements.length > 0) {
        const lines = ["# Extraction warnings", "", ...disagreements.flatMap((item) => [
          `- ${item.level} disagreement between ${item.processors.join(" and ")}.`,
          item.first_different_line ? `  First differing line reported at line ${item.first_different_line.line_no}.` : null,
        ].filter(Boolean)), "", "Consult the original document before relying on disputed wording.", ""];
        await fs.writeFile(path.join(targetRoot, "warnings.md"), lines.join("\n"), "utf8");
      }

      const contexts = sourceContext(manifest);
      const metadata = {
        sha256,
        mime_type: manifest.persisted.file_binary.mime_type,
        file_extension: manifest.persisted.file_binary.file_extension,
        page_count: manifest.persisted.file_binary.page_count,
        documents: contexts,
        available_extracted_content: available,
        extraction_warnings: disagreements,
      };
      await fs.writeFile(path.join(targetRoot, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      const first = contexts[0] ?? {};
      const occurrence = first.occurrences?.[0] ?? {};
      indexRows.push({
        sha256,
        process_number: occurrence.process_number,
        document_reference: first.document_reference,
        document_name: first.document_name,
        document_date: first.document_date,
        document_type: first.document_type,
        page_count: metadata.page_count,
        has_warnings: disagreements.length > 0,
        folder: `documents/${sha256}`,
      });
    }
    await fs.writeFile(path.join(outputDir, "documents.csv"), toCsv([
      "sha256", "process_number", "document_reference", "document_name", "document_date",
      "document_type", "page_count", "has_warnings", "folder",
    ], indexRows), "utf8");
    return { outputDir, binaryCount: indexRows.length };
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}
