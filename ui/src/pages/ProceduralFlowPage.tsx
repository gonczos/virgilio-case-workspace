import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type NodeSingular } from "cytoscape";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { getProceduralBucketExpansion, getProceduralFlow, type ProceduralFlowGraphNode,
  type ProceduralFlowResponse } from "../api/consultation";
import { bucketLabel, chronologicalEdges, positionProceduralBuckets } from "../utils/proceduralFlow";

const expansionPosition = (focus: NodeSingular, index: number) => {
  const angle = (index % 8) * (Math.PI / 4);
  const ring = Math.floor(index / 8) + 1;
  return { x: focus.position("x") + Math.cos(angle) * 105 * ring,
    y: focus.position("y") + Math.sin(angle) * 82 * ring };
};

export function ProceduralFlowPage() {
  const container = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const expanded = useRef(new Set<number>());
  const [data, setData] = useState<ProceduralFlowResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [loadingBucket, setLoadingBucket] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getProceduralFlow().then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!data || !container.current) return;
    const positioned = positionProceduralBuckets(data.lanes, data.buckets);
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...positioned.map((bucket) => ({ data: { ...bucket, displayLabel: bucketLabel(bucket) },
          position: { x: bucket.x, y: bucket.y } })),
        ...chronologicalEdges(positioned),
      ],
      style: [
        { selector: "node", style: { label: "data(displayLabel)", "text-wrap": "wrap", "text-max-width": "125px",
          "font-size": "11px", "min-zoomed-font-size": 9, "text-valign": "bottom", "text-margin-y": 7,
          "background-color": "#1f4f5f", width: 28, height: 28 } },
        { selector: "node[file_availability = 'missing']", style: { "background-color": "#a6512d", shape: "diamond" } },
        { selector: "node[kind = 'source_document']", style: { "background-color": "#5d7c52", shape: "round-rectangle" } },
        { selector: "node[kind = 'binary']", style: { "background-color": "#555", shape: "hexagon" } },
        { selector: "node[kind = 'related_occurrence']", style: { "background-color": "#397f9a", shape: "diamond" } },
        { selector: "edge[kind = 'chronological_next']", style: { width: 1, "line-color": "#a8a39a",
          "curve-style": "straight", "target-arrow-shape": "none" } },
        { selector: "edge[basis = 'source_recorded']", style: { width: 2, "line-color": "#5f6d68",
          "target-arrow-color": "#5f6d68", "target-arrow-shape": "triangle", "curve-style": "bezier" } },
        { selector: ":selected", style: { "border-width": 4, "border-color": "#9d5d2f" } },
      ],
      layout: { name: "preset", fit: true, padding: 45 },
      minZoom: 0.08, maxZoom: 2.5,
    });
    cy.on("tap", "node", (event) => setSelected(event.target.data()));
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [data]);

  const expandSelected = async () => {
    const bucketId = Number(selected?.bucket_id);
    const cy = cyRef.current;
    if (!cy || !Number.isFinite(bucketId) || expanded.current.has(bucketId)) return;
    setLoadingBucket(bucketId); setError(null);
    try {
      const result = await getProceduralBucketExpansion(bucketId);
      const focus = cy.getElementById(`bucket:${bucketId}`);
      const newNodes = result.nodes.filter((node) => cy.getElementById(node.id).empty());
      cy.add(newNodes.map((node, index) => ({ group: "nodes", data: { ...node,
        displayLabel: node.kind === "binary" ? `PDF\n${String(node.sha256).slice(0, 8)}…`
          : node.kind === "related_occurrence" ? `${node.occurrence_date ?? "Date unavailable"}\n${node.label}`
            : node.label }, position: expansionPosition(focus, index) })));
      cy.add(result.edges.filter((edge) => cy.getElementById(edge.id).empty() &&
        cy.getElementById(edge.source).nonempty() && cy.getElementById(edge.target).nonempty())
        .map((edge) => ({ group: "edges", data: edge })));
      expanded.current.add(bucketId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setLoadingBucket(null); }
  };

  const selectedKind = String(selected?.kind ?? "");
  const openHref = (selected as ProceduralFlowGraphNode | null)?.open_action?.href;
  return <Stack spacing={2}>
    <Box><Typography variant="h4">Procedural flow</Typography>
      <Typography color="text.secondary">Court-system buckets arranged by recorded date and process. Select a bucket to reveal its documents and reused files.</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}
    {!data && !error && <CircularProgress />}
    {data && <>
      <Alert severity="info">{data.lanes.length} process tracks · {data.buckets.length} recorded buckets. Timeline adjacency is not a claim of causality.</Alert>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {data.lanes.map((lane) => <Typography key={lane.id} variant="body2" color="text.secondary">
          {lane.is_base_case ? "Main:" : "Track:"} {lane.process_number}
        </Typography>)}
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <Box ref={container} aria-label="Procedural flow graph" sx={{ height: 680 }} />
        </Paper>
        <Paper variant="outlined" sx={{ width: { xs: "100%", md: 350 }, p: 2 }}>
          <Typography variant="h6">{selected ? String(selected.label ?? selected.reference_number ?? selected.id) : "Select a bucket"}</Typography>
          {selected ? <Stack spacing={1.5} mt={2}>
            <Typography variant="body2" color="text.secondary">{selectedKind.replaceAll("_", " ")}</Typography>
            {selectedKind === "bucket" && Boolean(selected.expandable) && <Button onClick={expandSelected}
              disabled={loadingBucket === Number(selected.bucket_id) || expanded.current.has(Number(selected.bucket_id))}
              variant="contained">{expanded.current.has(Number(selected.bucket_id)) ? "Relations added" : loadingBucket ? "Adding…" : "Add documents and reused files"}</Button>}
            {openHref && <Button component={RouterLink} to={openHref} target="_blank" rel="noopener noreferrer" variant="outlined">Open original PDF</Button>}
            <Box component="pre" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, m: 0 }}>{JSON.stringify(selected, null, 2)}</Box>
          </Stack> : <Typography variant="body2" color="text.secondary" mt={2}>Process tracks share one date axis. Undated buckets appear at the end of their lane.</Typography>}
        </Paper>
      </Stack>
      <Typography variant="body2" color="text.secondary">Blue circles are available buckets; orange diamonds have no linked binary. Added rectangles are source documents, hexagons are PDFs, and diamonds are other occurrences of the same PDF.</Typography>
    </>}
  </Stack>;
}
