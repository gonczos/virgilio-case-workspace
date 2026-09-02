import fs from "node:fs/promises";
import path from "node:path";

import {
  AI_CONSULTATION_EXPORTER,
  AI_CONSULTATION_EXPORTER_VERSION,
  AI_CONSULTATION_PACKAGE_FORMAT,
  AI_CONSULTATION_PACKAGE_VERSION,
} from "./ai-consultation-contract.mjs";
import { inspectFactualExport } from "./factual-export-inspect.mjs";
import { normalizeComparisonText, tokenizeComparisonText } from "./processing-comparison.mjs";
import { sha256File } from "./processing-common.mjs";

const README = `# Court case document package

This folder contains original court-case documents and machine-readable versions that can help an AI locate, summarize, compare, and cite information.

Start with \`documents.csv\`. It has one row per binary, identified by the full SHA-256. Its scalar metadata fields are representative display values only; use each document's \`metadata.json\` for every linked source document, process number, and procedural occurrence.

## Guidance for consulting this package with AI

1. Start with \`documents.csv\`.
2. Use each document's \`metadata.json\` for the complete linked source-document and procedural-occurrence context.
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
- \`warnings.md\`: actionable extraction cautions rendered from \`metadata.json\`, when present.
- \`manifest.json\`: package identity and file-integrity inventory.

Machine extraction and AI answers can be incomplete or wrong. Check important conclusions against the original document. This package may contain sensitive personal and court-case information; keep it private.
`;

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(columns, rows) {
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

function toPosix(value) {
  return value.replace(/\\/gu, "/");
}

async function fileInventoryEntry(root, absolutePath) {
  const stats = await fs.stat(absolutePath);
  return {
    path: toPosix(path.relative(root, absolutePath)),
    size_bytes: Number(stats.size),
    sha256: await sha256File(absolutePath),
  };
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
  pdf_literal_text: { artifactKind: "literal_pdf_text", source: "text.txt", target: "evidence/pdf-literal-text.txt", text: true },
  pdf_signature_metadata: { artifactKind: "pdf_signature_metadata", source: "native.json", target: "evidence/pdf-signature-metadata.json" },
  pdf_structure_inventory: { artifactKind: "pdf_structure_inventory", source: "native.json", target: "evidence/pdf-structure-inventory.json" },
  xberg: { artifactKind: "xberg_interpretation", source: "complete-text.txt", target: "interpretations/xberg.txt", text: true },
  docling: { artifactKind: "docling_interpretation", source: "markdown.md", target: "interpretations/docling.md", text: true },
};

function diagnostic(code, category, details = {}) {
  return { code, category, actionable: false, ...details };
}

export function classifyUnavailableProcessor(processor, jobs) {
  const failedJob = jobs.find((job) => job.status === "failed");
  if (failedJob) {
    return diagnostic("PROCESSOR_JOB_FAILED", "availability", {
      actionable: true,
      severity: "warning",
      processor,
      state: "failed",
      factual_basis: `A ${processor} processing job failed and no eligible artifact is included.`,
      recommended_action: "Consult another representation and the original binary; rerun the processor if this channel is needed.",
    });
  }
  return diagnostic("PROCESSOR_OUTPUT_UNKNOWN", "availability", {
    processor,
    state: "unknown",
    factual_basis: `No eligible ${processor} artifact is present; the package cannot distinguish not run from another unavailable state.`,
  });
}

function meaningfulCharacterCount(text) {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

export function compareProcessorTexts(doclingText, xbergText) {
  const doclingNormalized = normalizeComparisonText(doclingText);
  const xbergNormalized = normalizeComparisonText(xbergText);
  const doclingMeaningful = meaningfulCharacterCount(doclingText);
  const xbergMeaningful = meaningfulCharacterCount(xbergText);
  const results = [];
  if (doclingNormalized !== xbergNormalized) {
    results.push(diagnostic("PROCESSOR_OUTPUTS_TEXTUALLY_NON_IDENTICAL", "content_comparison", {
      processors: ["docling", "xberg"],
      substantive_disagreement_assessment: "not_assessed",
      factual_basis: "Processor outputs are textually non-identical. No substantive disagreement assessment was performed.",
      counts: {
        docling_normalized_character_count: doclingNormalized.length,
        xberg_normalized_character_count: xbergNormalized.length,
        docling_token_count: tokenizeComparisonText(doclingNormalized).length,
        xberg_token_count: tokenizeComparisonText(xbergNormalized).length,
      },
    }));
  }
  const coverageRatio = Math.min(doclingMeaningful, xbergMeaningful) / Math.max(doclingMeaningful, xbergMeaningful);
  if (Number.isFinite(coverageRatio) && coverageRatio < 0.65) {
    results.push(diagnostic("LARGE_TEXT_COVERAGE_DIFFERENCE", "content_comparison", {
      actionable: true,
      severity: "warning",
      processors: ["docling", "xberg"],
      factual_basis: "The smaller interpretation contains less than 65% of the meaningful characters in the larger interpretation.",
      counts: { docling_meaningful_characters: doclingMeaningful, xberg_meaningful_characters: xbergMeaningful, coverage_ratio: coverageRatio, threshold: 0.65 },
      recommended_action: "Consult both independent interpretations and verify potentially omitted material against the original binary.",
    }));
  }
  return results;
}

function renderWarnings(diagnostics) {
  const warnings = diagnostics.filter((item) => item.actionable);
  if (warnings.length === 0) return null;
  const lines = ["# Extraction warnings", ""];
  for (const item of warnings) {
    lines.push(`## ${item.code}`);
    lines.push("");
    if (item.severity) lines.push(`- Severity: ${item.severity}`);
    if (item.processor) lines.push(`- Processor: ${item.processor}`);
    if (item.artifact_path) lines.push(`- Artifact: \`${item.artifact_path}\``);
    lines.push(`- Basis: ${item.factual_basis}`);
    if (item.counts) lines.push(`- Measurements: \`${JSON.stringify(item.counts)}\``);
    if (item.recommended_action) lines.push(`- Recommended action: ${item.recommended_action}`);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

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
  const packageDocuments = [];
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
      const originalRelativePath = `documents/${sha256}/original${extension}`;
      const originalTarget = path.join(outputDir, originalRelativePath);
      await fs.copyFile(path.join(sourceRoot, original.package_path), originalTarget);

      const artifacts = new Map(manifest.package_contents.representation_artifacts.map((row) => [row.representation_id, row]));
      const representations = preferredRepresentations(manifest, artifacts);
      const available = [];
      const diagnostics = [];
      const comparableText = new Map();
      const sourcePageCount = Number(manifest.persisted.file_binary.page_count ?? 0);
      const mimeType = manifest.persisted.file_binary.mime_type;

      const structure = representations.get("pdf_structure_inventory");
      const structureChannels = structure?.content_json?.channels_present ?? {};
      if (manifest.persisted.file_binary.machine_readability_status === "image_only_pdf") {
        diagnostics.push(diagnostic("SOURCE_PDF_NO_NATIVE_TEXT", "source_characteristic", {
          factual_basis: "The imported binary assessment classifies this PDF as image-only.",
          counts: { page_count: sourcePageCount },
        }));
      }
      if (structureChannels.page_raster_content === "present") {
        diagnostics.push(diagnostic("SOURCE_PDF_RASTER_CONTENT_PRESENT", "source_characteristic", {
          factual_basis: "The PDF structure inventory reports raster page content.",
          counts: { page_count: sourcePageCount },
        }));
      }

      for (const [processor, output] of Object.entries(OUTPUTS)) {
        const representation = representations.get(processor);
        const artifact = representation ? artifacts.get(representation.id) : null;
        if (processor.startsWith("pdf_") && mimeType !== "application/pdf") {
          diagnostics.push(diagnostic("PROCESSOR_NOT_APPLICABLE", "availability", {
            processor,
            state: "not_applicable",
            factual_basis: `The ${processor} channel applies to PDF inputs; the source MIME type is ${mimeType}.`,
          }));
          continue;
        }
        if (!representation || !artifact) {
          const jobs = manifest.persisted.processing_jobs.filter((job) => job.processor_key === processor);
          diagnostics.push(classifyUnavailableProcessor(processor, jobs));
          continue;
        }
        const sourceArtifact = path.join(sourceRoot, artifact.package_dir, output.source);
        const targetArtifact = path.join(targetRoot, output.target);
        let sourceStats;
        try {
          sourceStats = await fs.stat(sourceArtifact);
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
          diagnostics.push(diagnostic("DECLARED_ARTIFACT_MISSING", "integrity", {
            actionable: true,
            severity: "error",
            processor,
            artifact_path: output.target,
            state: "unavailable",
            factual_basis: "The selected representation declares an artifact that is absent from the verified source package.",
            recommended_action: "Do not rely on this representation; regenerate or repair the package from immutable source artifacts.",
          }));
          continue;
        }
        if (sourceStats.size === 0) {
          diagnostics.push(diagnostic("PROCESSOR_OUTPUT_EMPTY", "extraction_quality", {
            actionable: true,
            severity: "warning",
            processor,
            state: "empty",
            factual_basis: `The processor completed but its selected ${output.source} artifact is empty.`,
            counts: { size_bytes: 0 },
            recommended_action: "Use another representation and inspect the original binary.",
          }));
          continue;
        }
        let textValue = null;
        let meaningful = null;
        if (output.text) {
          textValue = await fs.readFile(sourceArtifact, "utf8");
          meaningful = meaningfulCharacterCount(textValue);
          if (meaningful === 0) {
            diagnostics.push(diagnostic("PROCESSOR_OUTPUT_EMPTY", "extraction_quality", {
              actionable: true,
              severity: "warning",
              processor,
              state: "empty",
              factual_basis: "The selected text artifact contains no letters or digits.",
              counts: { size_bytes: Number(sourceStats.size), meaningful_character_count: 0 },
              recommended_action: "Use an image-derived interpretation and inspect the original binary.",
            }));
            continue;
          }
        }
        await copyIfUseful(sourceArtifact, targetArtifact);
        const artifactRecord = {
          artifact_kind: output.artifactKind,
          processor: representation.processor_key,
          processor_version: representation.processor_version,
          relative_path: output.target,
          source_binary_sha256: sha256,
          extraction_method: representation.content_json?.extraction_method ?? null,
          ocr_mode: representation.metadata_json?.ocr_mode ?? null,
        };
        available.push(artifactRecord);
        diagnostics.push(diagnostic("PROCESSOR_OUTPUT_AVAILABLE", "availability", {
          processor,
          artifact_path: output.target,
          state: "available",
          factual_basis: "The declared artifact exists, is readable, and is non-empty.",
          counts: { size_bytes: Number(sourceStats.size) },
        }));
        if (output.text) {
          comparableText.set(processor, { text: textValue, meaningful, artifact: artifactRecord });
          if (meaningful < 100) {
            diagnostics.push(diagnostic("PROCESSOR_OUTPUT_NEARLY_EMPTY", "extraction_quality", {
              actionable: true,
              severity: "warning",
              processor,
              artifact_path: output.target,
              state: "nearly_empty",
              factual_basis: "The included text contains fewer than 100 letters or digits.",
              counts: { meaningful_character_count: meaningful, threshold: 100 },
              recommended_action: "Do not treat this as complete document text; inspect the original and another extraction channel.",
            }));
          }
        }
        const extractedPageCount = Number(representation.content_json?.page_count ?? sourcePageCount);
        if (sourcePageCount > 0 && extractedPageCount < sourcePageCount) {
          diagnostics.push(diagnostic("INCOMPLETE_PAGE_COVERAGE", "extraction_quality", {
            actionable: true,
            severity: "warning",
            processor,
            artifact_path: output.target,
            factual_basis: "The representation reports fewer pages than the source binary.",
            counts: { source_page_count: sourcePageCount, extracted_page_count: extractedPageCount, coverage_ratio: extractedPageCount / sourcePageCount },
            recommended_action: "Inspect missing pages in the original and use another extraction channel.",
          }));
        }
      }

      const docling = comparableText.get("docling");
      const xberg = comparableText.get("xberg");
      if (docling && xberg) {
        diagnostics.push(...compareProcessorTexts(docling.text, xberg.text));
      }

      const contexts = sourceContext(manifest);
      const signature = representations.get("pdf_signature_metadata");
      const metadata = {
        schema_version: 1,
        source_binary: {
          sha256,
          mime_type: mimeType,
          file_extension: manifest.persisted.file_binary.file_extension,
          page_count: sourcePageCount,
          machine_readability_status: manifest.persisted.file_binary.machine_readability_status,
          original_relative_path: `original${extension}`,
          pdf_characteristics: mimeType === "application/pdf" ? {
            native_text: structureChannels.native_text ?? "unknown",
            raster_page_content: structureChannels.page_raster_content ?? "unknown",
            signature_fields_or_dictionaries: structureChannels.signature_fields_or_dictionaries ?? "unknown",
            signature_count: signature?.content_json?.signature_count ?? null,
          } : null,
        },
        linked_source_documents: contexts,
        extracted_artifacts: available,
        diagnostics,
      };
      const metadataTarget = path.join(targetRoot, "metadata.json");
      await fs.writeFile(metadataTarget, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      const renderedWarnings = renderWarnings(diagnostics);
      if (renderedWarnings) await fs.writeFile(path.join(targetRoot, "warnings.md"), renderedWarnings, "utf8");
      const first = contexts[0] ?? {};
      const occurrence = first.occurrences?.[0] ?? {};
      const processNumbers = [...new Set(contexts.flatMap((item) => item.occurrences.map((row) => row.process_number)).filter(Boolean))].sort();
      const occurrenceCount = contexts.reduce((sum, item) => sum + item.occurrences.length, 0);
      indexRows.push({
        sha256,
        process_numbers: processNumbers.join(";"),
        source_document_count: contexts.length,
        occurrence_count: occurrenceCount,
        representative_process_number: occurrence.process_number,
        representative_document_reference: first.document_reference,
        representative_document_name: first.document_name,
        representative_document_date: first.document_date,
        representative_document_type: first.document_type,
        page_count: sourcePageCount,
        actionable_warning_count: diagnostics.filter((item) => item.actionable).length,
        folder: `documents/${sha256}`,
      });
      packageDocuments.push({
        sha256,
        metadata_path: `documents/${sha256}/metadata.json`,
        original_path: originalRelativePath,
      });
    }
    const indexTarget = path.join(outputDir, "documents.csv");
    await fs.writeFile(indexTarget, toCsv([
      "sha256", "process_numbers", "source_document_count", "occurrence_count",
      "representative_process_number", "representative_document_reference",
      "representative_document_name", "representative_document_date",
      "representative_document_type", "page_count", "actionable_warning_count", "folder",
    ], indexRows), "utf8");
    const files = [];
    for (const file of await fs.readdir(outputDir, { recursive: true, withFileTypes: true })) {
      if (!file.isFile() || file.name === "manifest.json") continue;
      files.push(await fileInventoryEntry(outputDir, path.join(file.parentPath, file.name)));
    }
    files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    const packageManifest = {
      package_format: AI_CONSULTATION_PACKAGE_FORMAT,
      package_version: AI_CONSULTATION_PACKAGE_VERSION,
      generated_at: new Date().toISOString(),
      exporter: { name: AI_CONSULTATION_EXPORTER, version: AI_CONSULTATION_EXPORTER_VERSION },
      binary_count: indexRows.length,
      index_path: "documents.csv",
      documents_root_path: "documents",
      hash_algorithm: "sha256",
      original_binaries_included: true,
      limitations: [
        "Extracted content is derived and processor-attributed; original binaries remain canonical.",
        "Textual non-identity is recorded without assessing substantive disagreement.",
        "The top-level index contains representative display fields; metadata.json contains complete linked context.",
      ],
      documents: packageDocuments,
      files,
    };
    await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(packageManifest, null, 2)}\n`, "utf8");
    return { outputDir, binaryCount: indexRows.length, manifest: packageManifest };
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}
