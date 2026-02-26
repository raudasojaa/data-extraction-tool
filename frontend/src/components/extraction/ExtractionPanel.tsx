import {
  Box,
  Button,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title,
  Badge,
} from "@mantine/core";
import { IconRefresh, IconDownload } from "@tabler/icons-react";
import type {
  Extraction,
  ValidationWarning,
  ReviewStatus,
  Correction,
} from "@/types/extraction";
import { StudyDataCard } from "./StudyDataCard";

interface ExtractionPanelProps {
  extraction: Extraction | null;
  loading?: boolean;
  onReExtract: () => void;
  onExport: () => void;
  extractionLoading?: boolean;
  corrections?: Correction[];
  onReviewStatusChange?: (
    fieldPath: string,
    status: "verified" | "needs_review" | "pending"
  ) => void;
}

export function ExtractionPanel({
  extraction,
  loading,
  onReExtract,
  onExport,
  extractionLoading,
  corrections = [],
  onReviewStatusChange,
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

  const completeness = extraction.completeness_summary;
  const reviewStatus = extraction.field_review_status || {};
  const validationWarnings = extraction.validation_warnings || [];

  // Compute review progress
  const reviewCounts = { verified: 0, needs_review: 0, pending: 0 };
  for (const field of Object.values(reviewStatus)) {
    const s = field?.status || "pending";
    if (s in reviewCounts) {
      reviewCounts[s as keyof typeof reviewCounts]++;
    }
  }
  const totalReview = reviewCounts.verified + reviewCounts.needs_review + reviewCounts.pending;

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

      {/* Completeness summary */}
      {completeness && (
        <Box mb="md" p="sm" bg="gray.0" style={{ borderRadius: 8 }}>
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={600}>
              Extraction Completeness
            </Text>
            <Group gap={4}>
              <Badge size="xs" color="green" variant="light">
                {completeness.high_confidence} high
              </Badge>
              <Badge size="xs" color="yellow" variant="light">
                {completeness.medium_confidence} med
              </Badge>
              <Badge size="xs" color="red" variant="light">
                {completeness.low_confidence} low
              </Badge>
              <Badge size="xs" color="gray" variant="light">
                {completeness.missing} missing
              </Badge>
            </Group>
          </Group>
          <Progress.Root size="sm">
            <Progress.Section
              value={(completeness.high_confidence / Math.max(completeness.total_fields, 1)) * 100}
              color="green"
            />
            <Progress.Section
              value={(completeness.medium_confidence / Math.max(completeness.total_fields, 1)) * 100}
              color="yellow"
            />
            <Progress.Section
              value={(completeness.low_confidence / Math.max(completeness.total_fields, 1)) * 100}
              color="red"
            />
          </Progress.Root>
          <Text size="xs" c="dimmed" mt={4}>
            {completeness.extracted}/{completeness.total_fields} fields extracted
          </Text>
        </Box>
      )}

      {/* Review progress */}
      {totalReview > 0 && (
        <Box mb="md" p="sm" bg="blue.0" style={{ borderRadius: 8 }}>
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={600}>
              Review Progress
            </Text>
            <Text size="xs" c="dimmed">
              {reviewCounts.verified}/{totalReview} verified
            </Text>
          </Group>
          <Progress.Root size="sm">
            <Progress.Section
              value={(reviewCounts.verified / Math.max(totalReview, 1)) * 100}
              color="green"
            />
            <Progress.Section
              value={(reviewCounts.needs_review / Math.max(totalReview, 1)) * 100}
              color="yellow"
            />
          </Progress.Root>
          {reviewCounts.needs_review > 0 && (
            <Text size="xs" c="yellow.8" mt={4}>
              {reviewCounts.needs_review} fields need review
            </Text>
          )}
        </Box>
      )}

      {/* Validation warnings summary */}
      {validationWarnings.length > 0 && (
        <Box mb="md" p="sm" bg="red.0" style={{ borderRadius: 8 }}>
          <Text size="xs" fw={600} c="red.8">
            {validationWarnings.length} validation warning{validationWarnings.length !== 1 ? "s" : ""}
          </Text>
          {validationWarnings.slice(0, 3).map((w, i) => (
            <Text key={i} size="xs" c="red.7" mt={2}>
              {w.message}
            </Text>
          ))}
          {validationWarnings.length > 3 && (
            <Text size="xs" c="red.6" mt={2}>
              +{validationWarnings.length - 3} more
            </Text>
          )}
        </Box>
      )}

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
                validationWarnings={validationWarnings}
                fieldReviewStatus={reviewStatus}
                corrections={corrections}
                onReviewStatusChange={onReviewStatusChange}
              />
            )
        )}

        {extraction.custom_fields && (
          <StudyDataCard
            fieldKey="custom_fields"
            label="Additional Fields"
            data={extraction.custom_fields}
            extractionId={extraction.id}
            validationWarnings={validationWarnings}
            fieldReviewStatus={reviewStatus}
            corrections={corrections}
            onReviewStatusChange={onReviewStatusChange}
          />
        )}
      </Stack>
    </Box>
  );
}
