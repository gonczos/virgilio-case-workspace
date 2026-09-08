import React from "react";
import ReactDOM from "react-dom/client";
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  Link as MuiLink,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import { BinariesPage } from "./pages/BinariesPage";
import { BinaryDetailPage } from "./pages/BinaryDetailPage";
import { ExtractionCoveragePage } from "./pages/ExtractionCoveragePage";
import { ReferenceSearchPage } from "./pages/ReferenceSearchPage";
import { ReferenceGraphPage } from "./pages/ReferenceGraphPage";
import { ProceduralFlowPage } from "./pages/ProceduralFlowPage";
import { OpenOriginalPage } from "./pages/OpenOriginalPage";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1f4f5f",
    },
    secondary: {
      main: "#9d5d2f",
    },
    background: {
      default: "#f5f1e8",
      paper: "#fffdf8",
    },
    warning: {
      main: "#a6512d",
    },
  },
  typography: {
    fontFamily: "\"Segoe UI\", \"Aptos\", sans-serif",
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

function App() {
  const releaseMode = import.meta.env.VITE_CONSULTATION_V1 === "true";
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box
          sx={{
            minHeight: "100vh",
            background:
              "radial-gradient(circle at top left, rgba(31,79,95,0.12), transparent 32%), linear-gradient(180deg, #f5f1e8 0%, #f1ece0 100%)",
          }}
        >
          <AppBar
            position="sticky"
            color="transparent"
            elevation={0}
            sx={{
              backdropFilter: "blur(18px)",
              borderBottom: "1px solid rgba(31,79,95,0.12)",
            }}
          >
            <Toolbar sx={{ gap: 2 }}>
              <Typography
                component={Link}
                to="/binaries"
                variant="h6"
                sx={{
                  color: "primary.main",
                  textDecoration: "none",
                }}
              >
                Virgilio Consultation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {releaseMode ? "Consultation V1" : "Corpus consultation MVP"}
              </Typography>
              {!releaseMode && <MuiLink component={Link} to="/reports/extraction-coverage" underline="hover" color="text.secondary">
                Extraction coverage
              </MuiLink>}
              <MuiLink component={Link} to="/reference-search" underline="hover" color="text.secondary">
                Reference search
              </MuiLink>
              {!releaseMode && <MuiLink component={Link} to="/reference-graph/105398957" underline="hover" color="text.secondary">
                Graph spike
              </MuiLink>}
              {!releaseMode && <MuiLink component={Link} to="/procedural-flow?reference=85759502" underline="hover" color="text.secondary">
                Procedural flow
              </MuiLink>}
              {!releaseMode && <MuiLink
                href="http://localhost:8055"
                target="_blank"
                rel="noreferrer"
                underline="hover"
                color="text.secondary"
              >
                Directus
              </MuiLink>}
            </Toolbar>
          </AppBar>
          <Container maxWidth={false} sx={{ py: 3 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/binaries" replace />} />
              <Route path="/binaries" element={<BinariesPage />} />
              <Route path="/binaries/:sha256" element={<BinaryDetailPage />} />
              <Route path="/open-original/:sha256" element={<OpenOriginalPage />} />
              {!releaseMode && <Route path="/reports/extraction-coverage" element={<ExtractionCoveragePage />} />}
              <Route path="/reference-search" element={<ReferenceSearchPage />} />
              {!releaseMode && <Route path="/reference-graph/:value" element={<ReferenceGraphPage />} />}
              {!releaseMode && <Route path="/procedural-flow" element={<ProceduralFlowPage />} />}
            </Routes>
          </Container>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
