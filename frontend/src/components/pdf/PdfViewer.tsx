import { useMemo } from "react";
import { Box, LoadingOverlay, Text } from "@mantine/core";
import { useExtractionStore } from "@/store/extractionStore";
import { CATEGORY_COLORS, type HighlightCategory } from "@/types/highlight";
import type { SourceLocation } from "@/types/extraction";

interface PdfViewerProps {
  pdfUrl: string;
  loading?: boolean;
}

export function PdfViewer({ pdfUrl, loading }: PdfViewerProps) {
  const activeHighlights = useExtractionStore((s) => s.activeHighlights);
  const activeField = useExtractionStore((s) => s.activeField);

  const highlightColor = useMemo(() => {
    if (!activeField) return "#fbbf24";
    const category = activeField.split(".")[0] as HighlightCategory;
    return CATEGORY_COLORS[category] || "#fbbf24";
  }, [activeField]);

  return (
    <Box pos="relative" h="100%">
      <LoadingOverlay visible={!!loading} />

      {/* PDF embed with highlight overlay */}
      <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
        {activeHighlights.length > 0 && (
          <Box
            p="xs"
            bg="yellow.0"
            style={{ borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}
          >
            <Text size="xs" c="dimmed">
              Highlighting {activeHighlights.length} location(s) for{" "}
              <strong>{activeField?.replace("_", " ")}</strong>
            </Text>
          </Box>
        )}

        <Box style={{ flex: 1, overflow: "hidden" }}>
          <iframe
            src={`${pdfUrl}#toolbar=1`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title="PDF Viewer"
          />
        </Box>

        {/* Highlight legend */}
        {activeHighlights.length > 0 && (
          <Box p="xs" bg="gray.0" style={{ borderTop: "1px solid #e5e7eb" }}>
            {activeHighlights.map((loc, i) => (
              <HighlightBadge key={i} location={loc} color={highlightColor} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function HighlightBadge({
  location,
  color,
}: {
  location: SourceLocation;
  color: string;
}) {
  return (
    <Box
      p={4}
      mb={4}
      style={{
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        backgroundColor: `${color}10`,
        fontSize: 12,
      }}
    >
      <Text size="xs" c="dimmed">
        Page {location.page}
      </Text>
      <Text size="xs" lineClamp={2}>
        "{location.text}"
      </Text>
    </Box>
  );
}
