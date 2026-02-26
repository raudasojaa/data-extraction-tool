import {
  Box,
  Button,
  Card,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import type { SynthesisData } from "@/types/extraction";

interface SynthesisPanelProps {
  synthesis: SynthesisData | null;
  loading?: boolean;
  onGenerateSynthesis: () => void;
  hasExtraction: boolean;
}

const SECTIONS: { key: keyof SynthesisData; label: string }[] = [
  { key: "key_findings", label: "Key Findings" },
  { key: "certainty_of_evidence", label: "Certainty of Evidence" },
  { key: "strengths", label: "Strengths" },
  { key: "limitations", label: "Limitations" },
  { key: "clinical_implications", label: "Clinical Implications" },
];

export function SynthesisPanel({
  synthesis,
  loading,
  onGenerateSynthesis,
  hasExtraction,
}: SynthesisPanelProps) {
  if (loading) {
    return (
      <Box p="lg" ta="center">
        <Loader size="lg" mb="md" />
        <Text c="dimmed">Generating evidence synthesis...</Text>
      </Box>
    );
  }

  if (!synthesis) {
    return (
      <Box p="lg" ta="center">
        <Text c="dimmed" mb="md">
          {hasExtraction
            ? "No synthesis generated yet. Generate one from the extraction data."
            : "Extract data first before generating a synthesis."}
        </Text>
        <Button
          onClick={onGenerateSynthesis}
          leftSection={<IconSparkles size={16} />}
          disabled={!hasExtraction}
        >
          Generate Synthesis
        </Button>
      </Box>
    );
  }

  return (
    <Box p="md">
      <Stack gap="md">
        <Title order={4}>Evidence Synthesis</Title>

        {SECTIONS.map(({ key, label }) => {
          const content = synthesis[key];
          if (!content) return null;
          return (
            <Card key={key} withBorder shadow="xs" radius="sm">
              <Text fw={600} size="sm" mb="xs">
                {label}
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {content}
              </Text>
            </Card>
          );
        })}

        <Button
          variant="outline"
          size="xs"
          onClick={onGenerateSynthesis}
          leftSection={<IconSparkles size={14} />}
        >
          Re-generate Synthesis
        </Button>
      </Stack>
    </Box>
  );
}
