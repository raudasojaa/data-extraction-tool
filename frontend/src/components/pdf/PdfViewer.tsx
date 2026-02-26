import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, LoadingOverlay, Text, ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconZoomIn, IconZoomOut, IconX } from "@tabler/icons-react";
import * as pdfjsLib from "pdfjs-dist";
import { useExtractionStore } from "@/store/extractionStore";
import { CATEGORY_COLORS, type HighlightCategory } from "@/types/highlight";
import type { SourceLocation } from "@/types/extraction";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

interface PdfViewerProps {
  pdfUrl: string;
  loading?: boolean;
}

interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

const SCALE_STEP = 0.25;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const DEFAULT_SCALE = 1.2;

export function PdfViewer({ pdfUrl, loading }: PdfViewerProps) {
  const activeHighlights = useExtractionStore((s) => s.activeHighlights);
  const activeField = useExtractionStore((s) => s.activeField);
  const scrollToPage = useExtractionStore((s) => s.scrollToPage);
  const setScrollToPage = useExtractionStore((s) => s.setScrollToPage);
  const clearHighlights = useExtractionStore((s) => s.clearHighlights);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderingRef = useRef<Set<number>>(new Set());

  const highlightColor = useMemo(() => {
    if (!activeField) return "#fbbf24";
    const category = activeField.split(".")[0] as HighlightCategory;
    return CATEGORY_COLORS[category] || "#fbbf24";
  }, [activeField]);

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl) return;
    setPdfLoading(true);
    setError(null);

    const loadTask = pdfjsLib.getDocument(pdfUrl);
    loadTask.promise
      .then(async (doc) => {
        setPdfDoc(doc);
        setNumPages(doc.numPages);

        // Get page dimensions for all pages
        const infos: PageInfo[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          infos.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
          });
        }
        setPageInfos(infos);
        setPdfLoading(false);
      })
      .catch((err) => {
        setError("Failed to load PDF");
        setPdfLoading(false);
      });

    return () => {
      loadTask.destroy();
    };
  }, [pdfUrl]);

  // Render a page on its canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || renderingRef.current.has(pageNum)) return;
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) return;

      renderingRef.current.add(pageNum);
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;
      } finally {
        renderingRef.current.delete(pageNum);
      }
    },
    [pdfDoc, scale]
  );

  // Render all pages when doc/scale changes
  useEffect(() => {
    if (!pdfDoc) return;
    for (let i = 1; i <= numPages; i++) {
      renderPage(i);
    }
  }, [pdfDoc, numPages, scale, renderPage]);

  // Scroll to page when triggered from extraction panel
  useEffect(() => {
    if (scrollToPage && containerRef.current) {
      const pageEl = containerRef.current.querySelector(
        `[data-page="${scrollToPage}"]`
      );
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setScrollToPage(null);
    }
  }, [scrollToPage, setScrollToPage]);

  // Auto-scroll to first highlight page
  useEffect(() => {
    if (activeHighlights.length > 0 && containerRef.current) {
      const firstPage = activeHighlights[0].page;
      const pageEl = containerRef.current.querySelector(
        `[data-page="${firstPage}"]`
      );
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeHighlights]);

  const setCanvasRef = useCallback(
    (pageNum: number) => (el: HTMLCanvasElement | null) => {
      if (el) {
        canvasRefs.current.set(pageNum, el);
        renderPage(pageNum);
      } else {
        canvasRefs.current.delete(pageNum);
      }
    },
    [renderPage]
  );

  if (loading || pdfLoading) {
    return (
      <Box pos="relative" h="100%">
        <LoadingOverlay visible />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="lg" ta="center">
        <Text c="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box pos="relative" h="100%" style={{ display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <Box
        p={4}
        bg="gray.0"
        style={{
          borderBottom: "1px solid #e5e7eb",
          flexShrink: 0,
        }}
      >
        <Group gap="xs" justify="space-between">
          <Group gap="xs">
            <Tooltip label="Zoom out">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
                disabled={scale <= MIN_SCALE}
              >
                <IconZoomOut size={16} />
              </ActionIcon>
            </Tooltip>
            <Text size="xs" c="dimmed">
              {Math.round(scale * 100)}%
            </Text>
            <Tooltip label="Zoom in">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
                disabled={scale >= MAX_SCALE}
              >
                <IconZoomIn size={16} />
              </ActionIcon>
            </Tooltip>
            <Text size="xs" c="dimmed">
              {numPages} pages
            </Text>
          </Group>

          {activeHighlights.length > 0 && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {activeHighlights.length} highlight(s) for{" "}
                <strong>{activeField?.replace(/_/g, " ")}</strong>
              </Text>
              <Tooltip label="Clear highlights">
                <ActionIcon variant="subtle" size="xs" onClick={clearHighlights}>
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>
      </Box>

      {/* PDF pages */}
      <Box
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#525659",
        }}
      >
        {pageInfos.map((info) => (
          <Box
            key={info.pageNumber}
            data-page={info.pageNumber}
            mx="auto"
            my="sm"
            pos="relative"
            style={{
              width: info.width * scale,
              height: info.height * scale,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            <canvas
              ref={setCanvasRef(info.pageNumber)}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
              }}
            />

            {/* Highlight overlays for this page */}
            {activeHighlights
              .filter((h) => h.page === info.pageNumber)
              .map((loc, i) => (
                <HighlightOverlay
                  key={i}
                  location={loc}
                  pageWidth={info.width * scale}
                  pageHeight={info.height * scale}
                  color={highlightColor}
                />
              ))}
          </Box>
        ))}
      </Box>

      {/* Highlight quotes sidebar */}
      {activeHighlights.length > 0 && (
        <Box
          p="xs"
          bg="gray.0"
          style={{
            borderTop: "1px solid #e5e7eb",
            flexShrink: 0,
            maxHeight: 120,
            overflow: "auto",
          }}
        >
          {activeHighlights.map((loc, i) => (
            <Box
              key={i}
              p={4}
              mb={4}
              style={{
                borderLeft: `3px solid ${highlightColor}`,
                borderRadius: 4,
                backgroundColor: `${highlightColor}10`,
                fontSize: 12,
              }}
            >
              <Text size="xs" c="dimmed">
                Page {loc.page}
              </Text>
              <Text size="xs" lineClamp={2}>
                &ldquo;{loc.text}&rdquo;
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function HighlightOverlay({
  location,
  pageWidth,
  pageHeight,
  color,
}: {
  location: SourceLocation;
  pageWidth: number;
  pageHeight: number;
  color: string;
}) {
  // Source locations use normalized 0-1 coordinates
  const left = location.x0 * pageWidth;
  const top = location.y0 * pageHeight;
  const width = (location.x1 - location.x0) * pageWidth;
  const height = (location.y1 - location.y0) * pageHeight;

  return (
    <Tooltip label={location.text} multiline w={300}>
      <Box
        pos="absolute"
        style={{
          left,
          top,
          width: Math.max(width, 4),
          height: Math.max(height, 4),
          backgroundColor: `${color}33`,
          border: `2px solid ${color}88`,
          borderRadius: 2,
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      />
    </Tooltip>
  );
}
