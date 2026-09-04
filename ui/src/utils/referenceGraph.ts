import type { ReferenceGraphEdge, ReferenceGraphNode } from "../api/consultation";

export function graphNodeLabel(node: ReferenceGraphNode): string {
  if (node.kind === "reference_value") return `Reference\n${node.label}`;
  if (node.kind === "reference_observation") return node.origin === "document_text" ? "Text citation" : "Recorded occurrence";
  if (node.kind === "occurrence") return `Occurrence ${node.label ?? "—"}\n${String(node.occurrence_date ?? "date unavailable")}`;
  if (node.kind === "source_document") return `Document ${String(node.document_id ?? "—")}`;
  if (node.kind === "representation") return `${String(node.processor_key ?? "Representation")}\n${String(node.representation_id ?? "")}`;
  if (node.kind === "binary") return `Binary\n${String(node.sha256 ?? node.label).slice(0, 8)}…`;
  return node.label ?? node.id;
}

export function visibleGraphEdges(edges: ReferenceGraphEdge[]): ReferenceGraphEdge[] {
  const direct = new Set(edges.filter((edge) => edge.kind === "directly_anchored_in")
    .map((edge) => `${edge.source}\u001f${edge.target}`));
  return edges.filter((edge) => edge.kind !== "associated_with" || !direct.has(`${edge.source}\u001f${edge.target}`));
}
