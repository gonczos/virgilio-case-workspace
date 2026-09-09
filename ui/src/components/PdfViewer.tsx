import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";

import { requireAuthenticatedResponse } from "../api/consultation";

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(url, { method: "HEAD" });
        requireAuthenticatedResponse(response);
        if (!response.ok) {
          throw new Error(`PDF request failed with ${response.status}`);
        }
        if (active) setReady(true);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    })();
    return () => { active = false; };
  }, [url]);

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid rgba(31,79,95,0.12)",
        minHeight: 520,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(31,79,95,0.12)" }}
      >
        <Typography variant="h6">Original PDF</Typography>
      </Stack>
      <Box
        sx={{
          flex: 1,
          overflow: "hidden",
          p: ready ? 0 : 2,
          display: "flex",
          justifyContent: "center",
          alignItems: ready ? "stretch" : "center",
          bgcolor: "#ebe4d7",
        }}
      >
        {ready ? (
          <Box
            component="iframe"
            src={url}
            title="Original PDF"
            sx={{ width: "100%", minHeight: 680, border: 0, bgcolor: "#ffffff" }}
          />
        ) : error ? (
          <Alert severity="warning">PDF preview unavailable: {error}</Alert>
        ) : (
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography color="text.secondary">Loading PDF...</Typography>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}
