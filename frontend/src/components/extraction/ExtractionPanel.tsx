import { Box, Button, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { IconRefresh, IconDownload } from "@tabler/icons-react";
import type { Extraction } from "@/types/extraction";
import { StudyDataCard } from "./StudyDataCard";

interface ExtractionPanelProps {
  extraction: Extraction | null;
  loading?: boolean;
  onReExtract: () => void;
  onExport: () => void;
  extractionLoading?: boolean;
}

export function ExtractionPanel({
  extraction,
  loading,
  onReExtract,
  onExport,
  extractionLoading,
}: ExtractionPanelProps) {
  if (loading || extractionLoading) {
    return (
      <Box p="lg" ta="center">
        <Loader size="lg" mb="md" />
        <Text c="dimmed">
          {extractionLoading
            ? "Extracting data from article..."
            : "Loading extraction data..."}
        </Text>
      </Box>
    );
  }

  if (!extraction) {
    return (
      <Box p="lg" ta="center">
        <Text c="dimmed" mb="md">
          No extraction data available.
        </Text>
        <Button onClick={onReExtract} leftSection={<IconRefresh size={16} />}>
          Extract Data
        </Button>
      </Box>
    );
  }

  const sections = [
    { key: "study_design", label: "Study Design", data: extraction.study_design },
    { key: "population", label: "Population", data: extraction.population },
    { key: "intervention", label: "Intervention", data: extraction.intervention },
    { key: "comparator", label: "Comparator", data: extraction.comparator },
    { key: "outcomes", label: "Outcomes", data: extraction.outcomes },
    { key: "setting", label: "Setting", data: extraction.setting },
    { key: "follow_up", label: "Follow-up", data: extraction.follow_up },
    { key: "funding", label: "Funding", data: extraction.funding },
    { key: "limitations", label: "Limitations", data: extraction.limitations },
    { key: "conclusions", label: "Conclusions", data: extraction.conclusions },
  ];

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4}>Extracted Data</Title>
          <Text size="xs" c="dimmed">
            Version {extraction.version} | {extraction.model_used || "N/A"}
          </Text>
        </div>
        <Group>
          <Button
            variant="outline"
            size="xs"
            onClick={onReExtract}
            leftSection={<IconRefresh size={14} />}
          >
            Re-extract
          </Button>
          <Button
            size="xs"
            onClick={onExport}
            leftSection={<IconDownload size={14} />}
          >
            Export Word
          </Button>
        </Group>
      </Group>

      <Stack gap="sm">
        {sections.map(
          (section) =>
            section.data && (
              <StudyDataCard
                key={section.key}
                fieldKey={section.key}
                label={section.label}
                data={section.data}
                extractionId={extraction.id}
              />
            )
        )}

        {extraction.custom_fields && (
          <StudyDataCard
            fieldKey="custom_fields"
            label="Additional Fields"
            data={extraction.custom_fields}
            extractionId={extraction.id}
          />
        )}
      </Stack>
    </Box>
  );
}
