import { lookupRecordedReferences } from "./reference-observation-api.mjs";

export const REFERENCE_GRAPH_MAX_NODES = 100;
export const REFERENCE_GRAPH_MAX_EDGES = 200;

export function parseReferenceGraphOptions(searchParams) {
  const allowed = new Set(["scope", "lifecycle"]);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) return { error: ["UNKNOWN_QUERY_PARAMETER", `unknown query parameter: ${key}`] };
    if (searchParams.getAll(key).length > 1) return { error: ["DUPLICATE_QUERY_PARAMETER", `${key} must be supplied at most once`] };
  }
  const scope = searchParams.get("scope") ?? "pilot";
  const lifecycle = searchParams.get("lifecycle") ?? "current";
  if (scope !== "pilot") return { error: ["INVALID_GRAPH_SCOPE", "scope must be pilot"] };
  if (lifecycle !== "current") return { error: ["INVALID_GRAPH_LIFECYCLE", "lifecycle must be current"] };
  return { scope, lifecycle };
}

const stable = (values) => values.filter((value) => value != null).join(":");

export function buildReferenceNeighbourhoodGraph(lookup) {
  const nodes = new Map();
  const edges = new Map();
  const addNode = (node) => { if (node?.id) nodes.set(node.id, node); };
  const addEdge = (edge) => {
    if (!edge?.source || !edge?.target) return;
    const id = edge.id ?? stable([edge.kind, edge.source, edge.target]);
    edges.set(id, { ...edge, id });
  };
  const normalized = lookup.query.normalized_value;
  const referenceId = `reference:${normalized}`;
  addNode({ id: referenceId, kind: "reference_value", label: lookup.query.raw_value,
    normalized_value: normalized });

  for (const observation of lookup.observations) {
    const observationId = `observation:${observation.observation_key}`;
    addNode({ id: observationId, kind: "reference_observation",
      label: observation.reference.raw_value, origin: observation.origin,
      lifecycle_state: observation.lifecycle.state, direct_anchor: observation.direct_anchor,
      provenance: observation.provenance, human_review: observation.human_review });
    addEdge({ source: referenceId, target: observationId, kind: "has_observation",
      basis: "observed" });

    const anchor = observation.direct_anchor;
    let anchorId = null;
    if (anchor.kind === "document_text" && anchor.document_representation_id != null) {
      anchorId = `representation:${anchor.document_representation_id}`;
      addNode({ id: anchorId, kind: "representation", label: `Representation ${anchor.document_representation_id}`,
        representation_id: anchor.document_representation_id, processor_key: anchor.processor_key,
        processor_version: anchor.processor_version, page_no: anchor.page_no,
        char_start: anchor.char_start, char_end: anchor.char_end });
    } else if (anchor.bucket_id != null) {
      anchorId = `occurrence:${anchor.bucket_id}`;
      addNode({ id: anchorId, kind: "occurrence", label: anchor.occurrence_reference,
        bucket_id: anchor.bucket_id, process_number: anchor.process_number,
        occurrence_date: anchor.occurrence_date });
    } else if (anchor.document_id != null) {
      anchorId = `document:${anchor.document_id}`;
      addNode({ id: anchorId, kind: "source_document", label: anchor.document_reference,
        document_id: anchor.document_id });
    } else if (anchor.case_file_id != null) {
      anchorId = `case:${anchor.case_file_id}`;
      addNode({ id: anchorId, kind: "case_file", label: anchor.process_number,
        case_file_id: anchor.case_file_id });
    }
    if (anchorId) addEdge({ source: observationId, target: anchorId,
      kind: "directly_anchored_in", basis: observation.origin === "document_text" ? "observed" : "source_recorded" });

    for (const context of observation.associated_contexts) {
      const occurrenceId = context.bucket_id == null ? null : `occurrence:${context.bucket_id}`;
      const documentId = context.document_id == null ? null : `document:${context.document_id}`;
      if (occurrenceId) {
        addNode({ id: occurrenceId, kind: "occurrence", label: context.occurrence_reference,
          bucket_id: context.bucket_id, process_number: context.process_number,
          occurrence_date: context.occurrence_date, file_availability: context.file_availability });
        addEdge({ source: observationId, target: occurrenceId, kind: "associated_with", basis: "source_recorded" });
      }
      if (documentId) {
        addNode({ id: documentId, kind: "source_document", label: context.document_reference,
          document_id: context.document_id, file_availability: context.file_availability });
        addEdge({ source: observationId, target: documentId,
          kind: "associated_with", basis: "source_recorded" });
        addEdge({ source: occurrenceId ?? observationId, target: documentId,
          kind: "associated_with", basis: "source_recorded" });
      }
      for (const sha256 of context.binary_sha256s ?? []) {
        const binaryId = `binary:${sha256}`;
        addNode({ id: binaryId, kind: "binary", label: sha256, sha256,
          open_action: { href: `/api/consultation/binaries/${sha256}` } });
        addEdge({ source: observationId, target: binaryId,
          kind: "associated_with", basis: "source_recorded" });
        addEdge({ source: documentId ?? occurrenceId ?? observationId, target: binaryId,
          kind: "represented_by", basis: "source_recorded" });
      }
    }
  }

  const allNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const selectedNodes = allNodes.slice(0, REFERENCE_GRAPH_MAX_NODES);
  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const eligibleEdges = [...edges.values()]
    .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .sort((a, b) => a.id.localeCompare(b.id));
  const selectedEdges = eligibleEdges.slice(0, REFERENCE_GRAPH_MAX_EDGES);
  const truncated = allNodes.length > selectedNodes.length || eligibleEdges.length > selectedEdges.length;
  return {
    fixture: { reference_value: lookup.query.raw_value, normalized_value: normalized,
      scope: lookup.query.scope, lifecycle: lookup.query.lifecycle, depth: 2,
      limits: { nodes: REFERENCE_GRAPH_MAX_NODES, edges: REFERENCE_GRAPH_MAX_EDGES }, truncated },
    nodes: selectedNodes,
    edges: selectedEdges,
    coverage: lookup.coverage,
    limitations: [
      "This graph is a read-only projection of recorded-reference lookup data.",
      "Association edges are context, not resolved reference targets.",
      "No candidate-target, similarity, claim, or contradiction relationships are inferred.",
    ],
  };
}

export async function getReferenceNeighbourhoodGraph(client, value) {
  const lookup = await lookupRecordedReferences(client, value, {
    scope: "pilot", lifecycle: "current", limit: 100, offset: 0,
  });
  return buildReferenceNeighbourhoodGraph(lookup);
}
