import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography, useTheme } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getReferenceGraph, type ReferenceGraphNode, type ReferenceGraphResponse } from "../api/consultation";
import { graphNodeLabel, visibleGraphEdges } from "../utils/referenceGraph";

export function ReferenceGraphPage() {
  const { value = "105398957" } = useParams();
  const theme = useTheme();
  const container = useRef<HTMLDivElement | null>(null);
  const graph = useRef<Core | null>(null);
  const [data, setData] = useState<ReferenceGraphResponse | null>(null);
  const [selected, setSelected] = useState<ReferenceGraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null); setError(null); setSelected(null);
    getReferenceGraph(value).then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [value]);

  useEffect(() => {
    if (!data || !container.current) return;
    const colors: Record<string, string> = {
      reference_value: theme.palette.primary.main,
      reference_observation: theme.palette.secondary.main,
      occurrence: theme.palette.info.main,
      source_document: theme.palette.success.main,
      representation: theme.palette.warning.main,
      binary: theme.palette.grey[700],
    };
    graph.current?.destroy();
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...data.nodes.map((node) => ({ data: { ...node, displayLabel: graphNodeLabel(node) } })),
        ...visibleGraphEdges(data.edges).map((edge) => ({ data: { ...edge, displayLabel: edge.kind.replaceAll("_", " ") } })),
      ],
      style: [
        { selector: "node", style: { "background-color": (element) => colors[String(element.data("kind"))] ?? theme.palette.grey[500], label: "data(displayLabel)", color: theme.palette.text.primary, "font-size": "12px", "text-wrap": "wrap", "text-max-width": "120px", "text-valign": "bottom", "text-margin-y": 8, width: "38px", height: "38px" } },
        { selector: "node[kind = 'reference_value']", style: { width: "58px", height: "58px", "font-weight": 700 } },
        { selector: "edge", style: { width: "2px", "line-color": theme.palette.grey[500], "target-arrow-color": theme.palette.grey[500], "target-arrow-shape": "triangle", "curve-style": "bezier", label: "data(displayLabel)", "font-size": "9px", color: theme.palette.text.secondary, "text-background-color": theme.palette.background.paper, "text-background-opacity": 0.9, "text-background-padding": "2px" } },
        { selector: "edge[basis = 'observed']", style: { "line-style": "dashed", "line-color": theme.palette.secondary.main, "target-arrow-color": theme.palette.secondary.main } },
        { selector: ":selected", style: { "border-width": 4, "border-color": theme.palette.primary.dark } },
      ],
      layout: { name: "breadthfirst", directed: true, roots: [`reference:${data.fixture.normalized_value}`], spacingFactor: 1.35, padding: 40 },
    });
    cy.on("tap", "node", (event) => setSelected(event.target.data() as ReferenceGraphNode));
    graph.current = cy;
    return () => { cy.destroy(); graph.current = null; };
  }, [data, theme]);

  return <Stack spacing={2}>
    <Box><Typography variant="h4">Reference neighbourhood</Typography><Typography color="text.secondary">Pilot graph for {value}. Associations are context, not resolved targets.</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}
    {!data && !error && <CircularProgress />}
    {data && <>
      <Alert severity="info">{data.nodes.length} nodes · {visibleGraphEdges(data.edges).length} visible edges · No target relationship has been resolved.</Alert>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}><Box ref={container} aria-label={`Reference graph for ${value}`} sx={{ height: 620 }} /></Paper>
        <Paper variant="outlined" sx={{ width: { xs: "100%", md: 340 }, p: 2 }}>
          <Typography variant="h6">{selected ? graphNodeLabel(selected).replaceAll("\n", " · ") : "Select a node"}</Typography>
          {selected ? <Stack spacing={1.5} mt={2}>
            <Typography variant="body2" color="text.secondary">Kind: {selected.kind.replaceAll("_", " ")}</Typography>
            {selected.kind === "binary" && selected.sha256 && <Button component={RouterLink} to={`/binaries/${selected.sha256}`} target="_blank" rel="noopener noreferrer" variant="outlined">Open original PDF</Button>}
            <Box component="pre" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, m: 0 }}>{JSON.stringify(selected, null, 2)}</Box>
          </Stack> : <Typography variant="body2" color="text.secondary" mt={2}>Select a node to inspect its full identity and provenance.</Typography>}
        </Paper>
      </Stack>
      <Typography variant="body2" color="text.secondary">Solid edges are source-recorded context. Dashed edges are observations in extracted document text. No candidate-target, similarity, claim, or contradiction edges are shown.</Typography>
    </>}
  </Stack>;
}
