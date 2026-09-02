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
                Corpus consultation MVP
              </Typography>
              <MuiLink component={Link} to="/reports/extraction-coverage" underline="hover" color="text.secondary">
                Extraction coverage
              </MuiLink>
              <MuiLink
                href="http://localhost:8055"
                target="_blank"
                rel="noreferrer"
                underline="hover"
                color="text.secondary"
              >
                Directus
              </MuiLink>
            </Toolbar>
          </AppBar>
          <Container maxWidth={false} sx={{ py: 3 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/binaries" replace />} />
              <Route path="/binaries" element={<BinariesPage />} />
              <Route path="/binaries/:sha256" element={<BinaryDetailPage />} />
              <Route path="/reports/extraction-coverage" element={<ExtractionCoveragePage />} />
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
