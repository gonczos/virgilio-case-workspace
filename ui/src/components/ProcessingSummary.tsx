import {
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { BinaryDetailResponse } from "../types/consultation";
import { getRepresentationLabel } from "../utils/consultation";

interface ProcessingSummaryProps {
  detail: BinaryDetailResponse;
}

function statusColor(status: string): "success" | "warning" | "error" | "default" {
  switch (status) {
    case "completed":
      return "success";
    case "running":
    case "queued":
      return "warning";
    case "failed":
    case "blocked":
    case "cancelled":
      return "error";
    default:
      return "default";
  }
}

export function ProcessingSummary({ detail }: ProcessingSummaryProps) {
  return (
    <Paper elevation={0} sx={{ p: 2.25, border: "1px solid rgba(31,79,95,0.12)" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="h6">Processing</Typography>
        {detail.processing.summary.last_processed_at ? (
          <Typography variant="body2" color="text.secondary">
            Last processed {new Date(detail.processing.summary.last_processed_at).toLocaleString()}
          </Typography>
        ) : null}
      </Stack>
      <List dense disablePadding>
        {detail.processing.jobs.map((job) => (
          <ListItem key={job.processing_job_id} disableGutters sx={{ alignItems: "flex-start" }}>
            <ListItemText
              primary={`${getRepresentationLabel({ processor_key: job.processor_key })} · ${job.stage_key}`}
              secondary={(
                <>
                  {job.processor_version}
                  {job.completed_at ? ` · ${new Date(job.completed_at).toLocaleString()}` : ""}
                  {job.error_code ? ` · ${job.error_code}` : ""}
                  {job.error_message ? ` · ${job.error_message}` : ""}
                </>
              )}
            />
            <Chip size="small" color={statusColor(job.status)} label={job.status} />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
