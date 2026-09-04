import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core, type NodeSingular } from "cytoscape";
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { getProceduralBucketExpansion, getProceduralFlow, type ProceduralFlowGraphNode,
  type ProceduralFlowResponse } from "../api/consultation";
import { adjacentProceduralBuckets, bucketLabel, chronologicalEdges, chronologicalYearEdges, groupProceduralYears,
  positionProceduralBuckets, yearExpansionGrid, yearGroupLabel,
  type PositionedBucket } from "../utils/proceduralFlow";

const expansionPosition = (focus: NodeSingular, index: number) => {
  const angle = (index % 8) * (Math.PI / 4);
  const ring = Math.floor(index / 8) + 1;
  return { x: focus.position("x") + Math.cos(angle) * 105 * ring,
    y: focus.position("y") + Math.sin(angle) * 82 * ring };
};

export function ProceduralFlowPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const submittedReference = searchParams.get("reference")?.trim() ?? "";
  const [draftReference, setDraftReference] = useState(submittedReference);
  const container = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const positionedBuckets = useRef(new Map<number, PositionedBucket>());
  const expandedBuckets = useRef(new Set<number>());
  const expandedYears = useRef(new Set<string>());
  const expandedTimeline = useRef(new Set<number>());
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

  useEffect(() => setDraftReference(submittedReference), [submittedReference]);

  useEffect(() => {
    if (!data || !container.current) return;
    expandedBuckets.current.clear();
    expandedYears.current.clear();
    expandedTimeline.current.clear();
    setSelected(null);
    const positioned = positionProceduralBuckets(data.lanes, data.buckets, 2400);
    positionedBuckets.current = new Map(positioned.map((bucket) => [bucket.bucket_id, bucket]));
    const years = groupProceduralYears(positioned);
    const matched = submittedReference
      ? positioned.filter((bucket) => bucket.reference_number === submittedReference)
      : [];
    const initialElements = submittedReference
      ? matched.map((bucket, index) => ({ data: { ...bucket, displayLabel: bucketLabel(bucket) },
        position: { x: 260, y: 140 + index * 150 } }))
      : years.map((year) => ({ data: { ...year, label: `${year.process_number} · ${year.year}`,
        displayLabel: yearGroupLabel(year) }, position: { x: year.x, y: year.y } }));
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...initialElements,
        ...(submittedReference ? [] : chronologicalYearEdges(years)),
      ],
      style: [
        { selector: "node", style: { label: "data(displayLabel)", "text-wrap": "wrap", "text-max-width": "125px",
          "font-size": "11px", "text-valign": "bottom", "text-margin-y": 7,
          "background-color": "#1f4f5f", width: 28, height: 28 } },
        { selector: "node[file_availability = 'missing']", style: { "background-color": "#a6512d", shape: "diamond" } },
        { selector: "node[kind = 'year_group']", style: { "background-color": "#1f4f5f",
          shape: "round-rectangle", width: 86, height: 48, "font-size": "13px", "font-weight": 700,
          "text-max-width": "150px" } },
        { selector: "node[kind = 'source_document']", style: { "background-color": "#5d7c52", shape: "round-rectangle" } },
        { selector: "node[kind = 'binary']", style: { "background-color": "#555", shape: "hexagon" } },
        { selector: "node[kind = 'related_occurrence']", style: { "background-color": "#397f9a", shape: "diamond" } },
        { selector: "edge[kind = 'chronological_next']", style: { width: 1, "line-color": "#a8a39a",
          "curve-style": "straight", "target-arrow-shape": "none" } },
        { selector: "edge[kind = 'contains_occurrence']", style: { width: 1, "line-color": "#a8a39a",
          "line-style": "dotted", "curve-style": "bezier", "target-arrow-shape": "none" } },
        { selector: "edge[basis = 'source_recorded']", style: { width: 2, "line-color": "#5f6d68",
          "target-arrow-color": "#5f6d68", "target-arrow-shape": "triangle", "curve-style": "bezier" } },
        { selector: ":selected", style: { "border-width": 4, "border-color": "#9d5d2f" } },
      ],
      layout: { name: "preset", fit: false },
      zoom: 1,
      pan: submittedReference ? { x: 220, y: 180 } : { x: 30, y: 45 },
      minZoom: 0.08, maxZoom: 2.5,
    });
    cy.on("tap", "node", (event) => setSelected(event.target.data()));
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [data, submittedReference]);

  const revealAdjacentBuckets = () => {
    const bucketId = Number(selected?.bucket_id);
    const cy = cyRef.current;
    if (!cy || !data || !Number.isFinite(bucketId) || expandedTimeline.current.has(bucketId)) return;
    const focus = cy.getElementById(`bucket:${bucketId}`);
    const selectedDate = String(selected?.occurrence_date ?? "9999");
    const adjacent = adjacentProceduralBuckets(data.buckets, bucketId);
    adjacent.forEach((bucket, index) => {
      const nodeData = { ...bucket, displayLabel: bucketLabel(bucket) };
      const existing = cy.getElementById(bucket.id);
      const position = { x: focus.position("x") + (index === 0 ? -190 : 190), y: focus.position("y") };
      if (existing.nonempty()) { existing.data(nodeData); existing.position(position); }
      else cy.add({ group: "nodes", data: nodeData, position });
      const earlier = (bucket.occurrence_date ?? "9999").localeCompare(selectedDate) <= 0;
      const source = earlier ? bucket.id : `bucket:${bucketId}`;
      const target = earlier ? `bucket:${bucketId}` : bucket.id;
      const edgeId = `chronology:${source}:${target}`;
      if (cy.getElementById(edgeId).empty()) cy.add({ group: "edges", data: { id: edgeId, source, target,
        kind: "chronological_next", basis: "display_order" } });
    });
    expandedTimeline.current.add(bucketId);
    cy.animate({ fit: { eles: focus.union(adjacent.map((bucket) => cy.getElementById(bucket.id))
      .reduce((collection, node) => collection.union(node), cy.collection())), padding: 100 }, duration: 300 });
    setSelected({ ...selected, timeline_revealed: true });
  };

  const revealYear = () => {
    const yearId = String(selected?.id ?? "");
    const cy = cyRef.current;
    if (!cy || !yearId || expandedYears.current.has(yearId)) return;
    const ids = Array.isArray(selected?.bucket_ids) ? selected.bucket_ids.map(Number) : [];
    const buckets = ids.map((id) => positionedBuckets.current.get(id))
      .filter((item): item is PositionedBucket => Boolean(item));
    const revealedIds: string[] = [];
    for (const bucket of buckets) {
      const existing = cy.getElementById(bucket.id);
      const nodeData = { ...bucket, displayLabel: bucketLabel(bucket) };
      if (existing.nonempty()) {
        existing.data(nodeData);
        existing.position({ x: bucket.x, y: bucket.y });
      } else {
        cy.add({ group: "nodes", data: nodeData, position: { x: bucket.x, y: bucket.y } });
      }
      revealedIds.push(bucket.id);
    }
    cy.add(chronologicalEdges(buckets).filter((edge) => cy.getElementById(edge.data.id).empty()));
    cy.add(buckets.filter((bucket) => cy.getElementById(`year-member:${yearId}:${bucket.id}`).empty())
      .map((bucket) => ({ group: "edges" as const, data: { id: `year-member:${yearId}:${bucket.id}`,
        source: yearId, target: bucket.id, kind: "contains_occurrence", basis: "display_grouping" } })));
    const yearNode = cy.getElementById(yearId);
    const revealed = revealedIds.reduce((collection, id) => collection.union(cy.getElementById(id)), cy.collection());
    const grid = yearExpansionGrid(revealed.length);
    revealed.layout({
      name: "grid",
      fit: false,
      avoidOverlap: true,
      cols: grid.columns,
      boundingBox: {
        x1: yearNode.position("x") - grid.width / 2,
        y1: yearNode.position("y") + 75,
        w: grid.width,
        h: grid.height,
      },
    }).run();
    cy.animate({ fit: { eles: yearNode.union(revealed), padding: 90 }, duration: 300 });
    expandedYears.current.add(yearId);
    setSelected({ ...selected, revealed: true });
  };

  const expandSelected = async () => {
    const bucketId = Number(selected?.bucket_id);
    const cy = cyRef.current;
    if (!cy || !Number.isFinite(bucketId) || expandedBuckets.current.has(bucketId)) return;
    setLoadingBucket(bucketId); setError(null);
    try {
      const result = await getProceduralBucketExpansion(bucketId);
      const focus = cy.getElementById(`bucket:${bucketId}`);
      const newNodes = result.nodes.filter((node) => cy.getElementById(node.id).empty());
      const addedNodes = cy.add(newNodes.map((node, index) => ({ group: "nodes", data: { ...node,
        displayLabel: node.kind === "binary" ? `PDF\n${String(node.sha256).slice(0, 8)}…`
          : node.kind === "related_occurrence" ? `${node.occurrence_date ?? "Date unavailable"}\n${node.label}`
            : node.label }, position: expansionPosition(focus, index) })));
      const addedEdges = cy.add(result.edges.filter((edge) => cy.getElementById(edge.id).empty() &&
        cy.getElementById(edge.source).nonempty() && cy.getElementById(edge.target).nonempty())
        .map((edge) => ({ group: "edges", data: edge })));
      if (addedNodes.nonempty()) {
        focus.lock();
        focus.union(addedNodes).union(addedEdges).layout({
          name: "cose",
          animate: false,
          fit: false,
          randomize: false,
          nodeRepulsion: () => 8500,
          idealEdgeLength: () => 90,
          gravity: 0.8,
          boundingBox: {
            x1: focus.position("x") - 240,
            y1: focus.position("y") - 180,
            w: 480,
            h: 360,
          },
        }).run();
      }
      expandedBuckets.current.add(bucketId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setLoadingBucket(null); }
  };

  const selectedKind = String(selected?.kind ?? "");
  const openHref = (selected as ProceduralFlowGraphNode | null)?.open_action?.href;
  return <Stack spacing={2}>
    <Box><Typography variant="h4">Procedural flow</Typography>
      <Typography color="text.secondary">Start from one court reference and grow the procedural and evidence context one step at a time.</Typography></Box>
    <Stack component="form" direction={{ xs: "column", sm: "row" }} spacing={1}
      onSubmit={(event) => { event.preventDefault(); if (draftReference.trim()) setSearchParams({ reference: draftReference.trim() }); }}>
      <TextField label="Court reference number" value={draftReference}
        onChange={(event) => setDraftReference(event.target.value)} size="small" />
      <Button type="submit" variant="contained">Start from bucket</Button>
      {submittedReference && <Button onClick={() => setSearchParams({})}>Show year overview</Button>}
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {!data && !error && <CircularProgress />}
    {data && <>
      {submittedReference && !data.buckets.some((bucket) => bucket.reference_number === submittedReference)
        ? <Alert severity="warning">No bucket has the recorded court reference {submittedReference}.</Alert>
        : <Alert severity="info">{submittedReference ? `Starting from court reference ${submittedReference}.` : `${data.lanes.length} process tracks · ${data.buckets.length} recorded buckets, grouped by year.`} Timeline adjacency is not a claim of causality.</Alert>}
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
            {selectedKind === "year_group" && <Button onClick={revealYear}
              disabled={expandedYears.current.has(String(selected.id))} variant="contained">
              {expandedYears.current.has(String(selected.id)) ? "Buckets revealed" : `Reveal ${String(selected.bucket_count)} buckets`}
            </Button>}
            {selectedKind === "bucket" && <Button onClick={revealAdjacentBuckets}
              disabled={expandedTimeline.current.has(Number(selected.bucket_id))} variant="outlined">
              {expandedTimeline.current.has(Number(selected.bucket_id)) ? "Adjacent buckets added" : "Add previous and next buckets"}
            </Button>}
            {selectedKind === "bucket" && Boolean(selected.expandable) && <Button onClick={expandSelected}
              disabled={loadingBucket === Number(selected.bucket_id) || expandedBuckets.current.has(Number(selected.bucket_id))}
              variant="contained">{expandedBuckets.current.has(Number(selected.bucket_id)) ? "Relations added" : loadingBucket ? "Adding…" : "Add documents and reused files"}</Button>}
            {openHref && <Button component={RouterLink} to={openHref} target="_blank" rel="noopener noreferrer" variant="outlined">Open original PDF</Button>}
            <Box component="pre" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, m: 0 }}>{JSON.stringify(selected, null, 2)}</Box>
          </Stack> : <Typography variant="body2" color="text.secondary" mt={2}>Process tracks share one date axis. Undated buckets appear at the end of their lane.</Typography>}
        </Paper>
      </Stack>
      <Typography variant="body2" color="text.secondary">Blue circles are available buckets; orange diamonds have no linked binary. Timeline neighbours, source documents, PDFs, and reused occurrences are added only when requested.</Typography>
    </>}
  </Stack>;
}
