import {
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { RepresentationListItem } from "../types/consultation";
import { getRepresentationLabel } from "../utils/consultation";

interface ProvenanceSummaryProps {
  representation: RepresentationListItem | null;
  selectionReason: string;
}

export function ProvenanceSummary({ representation, selectionReason }: ProvenanceSummaryProps) {
  return (
    <Paper elevation={0} sx={{ p: 2.25, border: "1px solid rgba(31,79,95,0.12)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="h6">Viewed representation provenance</Typography>
        <Chip size="small" label={selectionReason === "explicit_human_selection" ? "Explicit selection in effect" : "Automatic policy"} />
      </Stack>
      {!representation ? (
        <Typography color="text.secondary">No representation is currently selected for viewing.</Typography>
      ) : (
        <List dense disablePadding>
          <ListItem disableGutters>
            <ListItemText primary="Representation" secondary={getRepresentationLabel(representation)} />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText primary="Processor" secondary={`${representation.processor_key} ${representation.processor_version}`} />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText primary="Source kind" secondary={representation.representation_source_kind} />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText primary="Created" secondary={new Date(representation.created_at).toLocaleString()} />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText primary="Produced by job" secondary={String(representation.produced_by_job_id)} />
          </ListItem>
          <ListItem disableGutters>
            <ListItemText primary="Based on representation" secondary={representation.based_on_representation_id ? String(representation.based_on_representation_id) : "None"} />
          </ListItem>
        </List>
      )}
    </Paper>
  );
}
