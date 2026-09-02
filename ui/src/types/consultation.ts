export type SelectionReason = "automatic_policy" | "explicit_human_selection" | string;

export interface RepresentationListItem {
  representation_id: number;
  representation_source_kind: string;
  representation_variant_key: string;
  representation_kind: string;
  format_family: string;
  processor_key: string;
  processor_version: string;
  created_at: string;
  based_on_representation_id: number | null;
  produced_by_job_id: number;
  produced_by_job_status: string | null;
  available_formats: string[];
  is_effective: boolean;
  is_explicitly_selected: boolean;
}

export interface BinaryCatalogueItem {
  file_binary_id: number;
  sha256: string;
  display_name: string;
  mime_type: string | null;
  file_extension: string | null;
  size_bytes: number | null;
  document_count: number;
  bucket_count: number;
  case_count: number;
  linked_document_names: string[];
  linked_case_refs: string[];
  processing_summary: {
    total_jobs: number;
    status_counts: Record<string, number>;
    processor_keys: string[];
    last_processed_at: string | null;
  };
  available_representations: RepresentationListItem[];
  effective_representation: {
    representation_id: number;
    processor_key: string;
    processor_version: string;
    representation_source_kind: string;
  } | null;
  effective_selection_reason: SelectionReason;
  review_needed: boolean;
  review_reason_codes: string[];
  last_processed_at: string | null;
}

export interface BinaryCatalogueResponse {
  total_count: number;
  limit: number;
  offset: number;
  items: BinaryCatalogueItem[];
}

export type ExtractionProcessorKey =
  | "pdf_literal_text"
  | "pdf_signature_metadata"
  | "pdf_structure_inventory"
  | "xberg"
  | "docling";

export interface ExtractionCoverageItem {
  file_binary_id: number;
  sha256: string;
  machine_readability_status: string | null;
  page_count: number | null;
  coverage: Record<ExtractionProcessorKey, boolean>;
  all_successful: boolean;
  has_missing_extraction: boolean;
  has_warnings: boolean;
  warning_processor_keys: ExtractionProcessorKey[];
}

export interface ExtractionCoverageReport {
  generated_at: string;
  processor_keys: ExtractionProcessorKey[];
  summary: {
    total_binaries: number;
    successful_binaries: number;
    binaries_with_missing_extractions: number;
    binaries_with_warnings: number;
    successful_by_processor: Record<ExtractionProcessorKey, number>;
  };
  items: ExtractionCoverageItem[];
}

export interface BinaryContextDocument {
  document_id: number;
  document_name: string | null;
  document_date: string | null;
  document_type: string | null;
  document_identity_class: string;
  is_primary_binary: boolean;
  source_observation_count: number | null;
}

export interface BinaryContextBucket {
  bucket_pk_id: number;
  bucket_id: string;
  bucket_date: string | null;
  designation: string | null;
  reference_number: string | null;
  presenter: string | null;
  case_file_id: number;
  processo: string;
}

export interface BinaryContextCase {
  case_file_id: number;
  processo: string;
  idprocesso: string | null;
  especie: string | null;
  estado: string | null;
  data_autuacao: string | null;
  case_workspace_id: number | null;
}

export interface BinaryContextWorkspace {
  case_workspace_id: number;
  workspace_code: string;
  title: string;
  lifecycle_status: string;
}

export interface ProcessingJobItem {
  processing_job_id: number;
  stage_key: string;
  status: string;
  processor_key: string;
  processor_version: string;
  requested_by: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  max_attempts: number;
  error_code: string | null;
  error_message: string | null;
  produced_representation_id: number | null;
}

export interface ComparisonItem {
  comparison_id: number;
  left_representation_id: number;
  right_representation_id: number;
  comparison_kind: string;
  comparator_key: string;
  comparator_version: string;
  disagreement_level: string | null;
  summary: Record<string, unknown>;
  created_at: string | null;
}

export interface BinaryDetailResponse {
  binary: {
    file_binary_id: number;
    sha256: string;
    mime_type: string | null;
    file_extension: string | null;
    machine_readability_status: string | null;
    page_count: number | null;
    size_bytes: number | null;
    display_name: string;
    original_binary_url: string;
  };
  context: {
    documents: BinaryContextDocument[];
    buckets: BinaryContextBucket[];
    cases: BinaryContextCase[];
    workspaces: BinaryContextWorkspace[];
  };
  processing: {
    jobs: ProcessingJobItem[];
    summary: {
      total_jobs: number;
      status_counts: Record<string, number>;
      processor_keys: string[];
      last_processed_at: string | null;
    };
  };
  representations: {
    items: RepresentationListItem[];
    effective: {
      representation_id: number;
      processor_key: string;
      processor_version: string;
      representation_source_kind: string;
    } | null;
    explicit_selection: {
      id: number;
      selected_representation_id: number;
      selected_by: string | null;
      selection_note: string | null;
    } | null;
    effective_selection_reason: SelectionReason;
  };
  evidence: {
    items: RepresentationListItem[];
  };
  comparisons: ComparisonItem[];
  attention: {
    review_needed: boolean;
    reason_codes: string[];
    reasons: Array<{ reason_code: string; detail?: Record<string, unknown> }>;
  };
  provenance: {
    effective_representation_id: number | null;
    selection_source: SelectionReason;
    explicit_selection_id: number | null;
  };
  technical_details: {
    binary_id: number;
    interpretation_representation_ids: number[];
    evidence_representation_ids: number[];
    representation_ids: number[];
    comparison_ids: number[];
  };
}

export type RepresentationContentResult =
  | { format: "text" | "markdown" | "complete-text"; body: string }
  | { format: "native-json"; body: unknown };
