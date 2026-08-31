import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from "@mui/material";

import type { BinaryDetailResponse, RepresentationListItem } from "../types/consultation";

interface TechnicalDetailsProps {
  detail: BinaryDetailResponse;
  viewedRepresentation: RepresentationListItem | null;
}

export function TechnicalDetails({ detail, viewedRepresentation }: TechnicalDetailsProps) {
  const payload = {
    binary_id: detail.technical_details.binary_id,
    sha256: detail.binary.sha256,
    representation_ids: detail.technical_details.representation_ids,
    comparison_ids: detail.technical_details.comparison_ids,
    viewed_representation_id: viewedRepresentation?.representation_id ?? null,
    review_reason_codes: detail.attention.reason_codes,
  };
  return (
    <Accordion disableGutters elevation={0} sx={{ border: "1px solid rgba(31,79,95,0.12)", bgcolor: "background.paper" }}>
      <AccordionSummary expandIcon={<Typography aria-hidden="true">+</Typography>}>
        <Typography variant="subtitle1">Technical details</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 13,
            lineHeight: 1.5,
            borderRadius: 2,
            bgcolor: "#f4efe4",
          }}
        >
          {JSON.stringify(payload, null, 2)}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
