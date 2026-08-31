import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let loadingTask: ReturnType<typeof getDocument> | null = null;
    setLoading(true);
    setError(null);
    setDocumentProxy(null);
    setPageNumber(1);
    void (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`PDF request failed with ${response.status}`);
        }
        const data = await response.arrayBuffer();
        loadingTask = getDocument({ data });
        const proxy = await loadingTask.promise;
        if (active) {
          setDocumentProxy(proxy);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!documentProxy || !canvasRef.current) {
      return;
    }
    let active = true;
    void (async () => {
      const page = await documentProxy.getPage(pageNumber);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      if (!canvas || !active) {
        return;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    })();
    return () => {
      active = false;
    };
  }, [documentProxy, pageNumber, zoom]);

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
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(31,79,95,0.12)", flexWrap: "wrap" }}
      >
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Original PDF
        </Typography>
        {documentProxy ? (
          <Chip size="small" label={`${pageNumber} / ${documentProxy.numPages}`} variant="outlined" />
        ) : null}
        <Button size="small" disabled={!documentProxy || pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)}>
          Previous
        </Button>
        <Button
          size="small"
          disabled={!documentProxy || pageNumber >= (documentProxy?.numPages ?? 0)}
          onClick={() => setPageNumber((value) => value + 1)}
        >
          Next
        </Button>
        <Button size="small" disabled={!documentProxy} onClick={() => setZoom((value) => Math.max(0.7, value - 0.15))}>
          Zoom -
        </Button>
        <Button size="small" disabled={!documentProxy} onClick={() => setZoom((value) => Math.min(2.2, value + 0.15))}>
          Zoom +
        </Button>
      </Stack>
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: loading || error ? "center" : "flex-start",
          bgcolor: "#ebe4d7",
        }}
      >
        {loading ? (
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography color="text.secondary">Loading PDF...</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="warning">PDF preview unavailable: {error}</Alert>
        ) : (
          <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto", boxShadow: "0 20px 45px rgba(0,0,0,0.18)" }} />
        )}
      </Box>
    </Paper>
  );
}
