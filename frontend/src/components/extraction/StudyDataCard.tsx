import { useState } from "react";
import {
  Card,
  Text,
  Group,
  ActionIcon,
  Collapse,
  Stack,
  Box,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconHighlight,
} from "@tabler/icons-react";
import { useExtractionStore } from "@/store/extractionStore";
import { EditableField } from "./EditableField";
import { CATEGORY_COLORS, type HighlightCategory } from "@/types/highlight";

interface StudyDataCardProps {
  fieldKey: string;
  label: string;
  data: Record<string, unknown>;
  extractionId: string;
}

export function StudyDataCard({
  fieldKey,
  label,
  data,
  extractionId,
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
          {displayFields.map(([key, value]) => (
            <EditableField
              key={key}
              fieldKey={`${fieldKey}.${key}`}
              label={key.replace(/_/g, " ")}
              value={value}
              extractionId={extractionId}
            />
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}
