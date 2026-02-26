import { useState } from "react";
import {
  Card,
  Text,
  Group,
  ActionIcon,
  Collapse,
  Stack,
  Box,
  Badge,
  RingProgress,
  Tooltip,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconHighlight,
} from "@tabler/icons-react";
import { useExtractionStore } from "@/store/extractionStore";
import { EditableField } from "./EditableField";
import { CATEGORY_COLORS, type HighlightCategory } from "@/types/highlight";
import type {
  ValidationWarning,
  ReviewStatus,
  Correction,
} from "@/types/extraction";

interface StudyDataCardProps {
  fieldKey: string;
  label: string;
  data: Record<string, unknown>;
  extractionId: string;
  validationWarnings?: ValidationWarning[];
  fieldReviewStatus?: Record<string, ReviewStatus>;
  corrections?: Correction[];
  onReviewStatusChange?: (
    fieldPath: string,
    status: "verified" | "needs_review" | "pending"
  ) => void;
}

export function StudyDataCard({
  fieldKey,
  label,
  data,
  extractionId,
  validationWarnings = [],
  fieldReviewStatus = {},
  corrections = [],
  onReviewStatusChange,
}: StudyDataCardProps) {
  const [opened, setOpened] = useState(true);
  const setActiveHighlights = useExtractionStore(
    (s) => s.setActiveHighlights
  );

  const category = fieldKey as HighlightCategory;
  const color = CATEGORY_COLORS[category] || "#6b7280";

  const sourceLocations = (data as Record<string, unknown>)
    .source_locations as Array<{
    page: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    text: string;
  }> | undefined;

  const handleHighlight = () => {
    if (sourceLocations && sourceLocations.length > 0) {
      setActiveHighlights(sourceLocations, fieldKey);
    }
  };

  // Filter out internal fields for display
  const displayFields = Object.entries(data).filter(
    ([key]) => !["source_locations", "quotes"].includes(key)
  );

  // Compute section completeness
  const sectionStats = computeSectionStats(displayFields);

  return (
    <Card withBorder shadow="xs" radius="sm">
      <Group
        justify="space-between"
        onClick={() => setOpened(!opened)}
        style={{ cursor: "pointer" }}
      >
        <Group gap="xs">
          {opened ? (
            <IconChevronDown size={16} />
          ) : (
            <IconChevronRight size={16} />
          )}
          <Box
            w={4}
            h={16}
            style={{ borderRadius: 2, backgroundColor: color }}
          />
          <Text fw={600} size="sm">
            {label}
          </Text>

          {/* Completeness indicator */}
          {sectionStats.total > 0 && (
            <Group gap={4}>
              <Tooltip
                label={`${sectionStats.extracted}/${sectionStats.total} fields extracted`}
              >
                <RingProgress
                  size={20}
                  thickness={3}
                  roundCaps
                  sections={[
                    {
                      value: (sectionStats.extracted / sectionStats.total) * 100,
                      color: sectionStats.extracted === sectionStats.total ? "green" : "blue",
                    },
                  ]}
                />
              </Tooltip>
              <Text size="xs" c="dimmed">
                {sectionStats.extracted}/{sectionStats.total}
              </Text>
            </Group>
          )}

          {/* Needs review badge */}
          {sectionStats.lowConfidence > 0 && (
            <Badge size="xs" color="yellow" variant="light">
              {sectionStats.lowConfidence} needs review
            </Badge>
          )}
        </Group>

        {sourceLocations && sourceLocations.length > 0 && (
          <ActionIcon
            variant="subtle"
            color="yellow"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleHighlight();
            }}
            title="Highlight in PDF"
          >
            <IconHighlight size={14} />
          </ActionIcon>
        )}
      </Group>

      <Collapse in={opened}>
        <Stack gap="xs" mt="sm">
          {displayFields.map(([key, value]) => {
            const fullPath = `${fieldKey}.${key}`;
            const fieldWarnings = validationWarnings.filter(
              (w) => w.field_path === fullPath || w.field_path.startsWith(`${fullPath}.`)
            );
            const reviewSt = fieldReviewStatus[fullPath];
            const fieldCorrections = corrections.filter(
              (c) => c.field_path === fullPath
            );

            return (
              <EditableField
                key={key}
                fieldKey={fullPath}
                label={key.replace(/_/g, " ")}
                value={value}
                extractionId={extractionId}
                validationWarnings={fieldWarnings}
                reviewStatus={reviewSt}
                corrections={fieldCorrections}
                onReviewStatusChange={
                  onReviewStatusChange
                    ? (status) => onReviewStatusChange(fullPath, status)
                    : undefined
                }
              />
            );
          })}
        </Stack>
      </Collapse>
    </Card>
  );
}

function computeSectionStats(fields: [string, unknown][]) {
  let total = 0;
  let extracted = 0;
  let lowConfidence = 0;

  for (const [, value] of fields) {
    if (typeof value === "object" && value !== null && "value" in (value as Record<string, unknown>)) {
      total++;
      const v = value as Record<string, unknown>;
      if (v.value !== null && v.value !== undefined) {
        extracted++;
        if (v.confidence === "low") {
          lowConfidence++;
        }
      } else if (v.missing_reason === "unclear") {
        lowConfidence++;
      }
    }
  }

  return { total, extracted, lowConfidence };
}
