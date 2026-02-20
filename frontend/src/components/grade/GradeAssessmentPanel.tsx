import { Box, Button, Group, Loader, Select, Stack, Text, Title } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import type { GradeAssessment } from "@/types/grade";
import { GradeDomainCard } from "./GradeDomainCard";
import { EvidenceQualityBadge } from "./EvidenceQualityBadge";
import { useState } from "react";

interface GradeAssessmentPanelProps {
  assessments: GradeAssessment[];
  loading?: boolean;
  onRunGrade: () => void;
  gradeLoading?: boolean;
}

export function GradeAssessmentPanel({
  assessments,
  loading,
  onRunGrade,
  gradeLoading,
}: GradeAssessmentPanelProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  if (loading || gradeLoading) {
    return (
      <Box p="lg" ta="center">
        <Loader size="lg" mb="md" />
        <Text c="dimmed">
          {gradeLoading
            ? "Running GRADE assessment..."
            : "Loading GRADE data..."}
        </Text>
      </Box>
    );
  }

  if (!assessments.length) {
    return (
      <Box p="lg" ta="center">
        <Text c="dimmed" mb="md">
          No GRADE assessment available. Run extraction first, then assess.
        </Text>
        <Button onClick={onRunGrade} leftSection={<IconRefresh size={16} />}>
          Run GRADE Assessment
        </Button>
      </Box>
    );
  }

  const selected =
    assessments.find((a) => a.outcome_name === selectedOutcome) ||
    assessments[0];

  const outcomeOptions = assessments.map((a) => ({
    value: a.outcome_name,
    label: a.outcome_name,
  }));

  const domains = [
    { key: "risk_of_bias", label: "Risk of Bias", data: selected.risk_of_bias },
    { key: "inconsistency", label: "Inconsistency", data: selected.inconsistency },
    { key: "indirectness", label: "Indirectness", data: selected.indirectness },
    { key: "imprecision", label: "Imprecision", data: selected.imprecision },
    {
      key: "publication_bias",
      label: "Publication Bias",
      data: selected.publication_bias,
    },
  ];

  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>GRADE Assessment</Title>
        <Button
          variant="outline"
          size="xs"
          onClick={onRunGrade}
          leftSection={<IconRefresh size={14} />}
        >
          Re-assess
        </Button>
      </Group>

      {assessments.length > 1 && (
        <Select
          label="Select Outcome"
          data={outcomeOptions}
          value={selected.outcome_name}
          onChange={setSelectedOutcome}
          mb="md"
          size="sm"
        />
      )}

      <Group mb="md" align="center">
        <Text fw={600}>{selected.outcome_name}</Text>
        <EvidenceQualityBadge certainty={selected.overall_certainty} />
      </Group>

      {selected.overall_rationale && (
        <Text size="sm" c="dimmed" mb="md">
          {selected.overall_rationale}
        </Text>
      )}

      <Stack gap="sm">
        {domains.map((domain) => (
          <GradeDomainCard
            key={domain.key}
            domainKey={domain.key}
            label={domain.label}
            data={domain.data}
            assessmentId={selected.id}
          />
        ))}
      </Stack>

      {/* Upgrade factors */}
      <Title order={5} mt="lg" mb="sm">
        Upgrade Factors
      </Title>
      <Stack gap="xs">
        {[
          { key: "large_effect", label: "Large Effect", data: selected.large_effect },
          { key: "dose_response", label: "Dose-Response", data: selected.dose_response },
          {
            key: "residual_confounding",
            label: "Residual Confounding",
            data: selected.residual_confounding,
          },
        ].map((factor) => (
          <Box key={factor.key} p="xs" bg="gray.0" style={{ borderRadius: 4 }}>
            <Group>
              <Text size="sm" fw={500}>
                {factor.label}:
              </Text>
              <Text size="sm" c={factor.data?.applicable ? "green" : "dimmed"}>
                {factor.data?.applicable ? "Applicable" : "Not applicable"}
              </Text>
            </Group>
            {factor.data?.rationale && (
              <Text size="xs" c="dimmed">
                {factor.data.rationale}
              </Text>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
