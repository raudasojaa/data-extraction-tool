import { useState } from "react";
import {
  Card,
  Text,
  Group,
  Badge,
  Box,
  Select,
  Textarea,
  Button,
  Stack,
  ActionIcon,
} from "@mantine/core";
import { IconHighlight } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { overrideGradeDomain } from "@/api/extractions";
import { useExtractionStore } from "@/store/extractionStore";
import type { GradeDomain } from "@/types/grade";

interface GradeDomainCardProps {
  domainKey: string;
  label: string;
  data: GradeDomain | null;
  assessmentId: string;
}

const RATING_COLORS: Record<string, string> = {
  no_serious: "green",
  serious: "yellow",
  very_serious: "red",
};

const RATING_LABELS: Record<string, string> = {
  no_serious: "No Serious",
  serious: "Serious",
  very_serious: "Very Serious",
};

export function GradeDomainCard({
  domainKey,
  label,
  data,
  assessmentId,
}: GradeDomainCardProps) {
  const [overriding, setOverriding] = useState(false);
  const [newRating, setNewRating] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const setActiveHighlights = useExtractionStore(
    (s) => s.setActiveHighlights
  );

  const overrideMutation = useMutation({
    mutationFn: () =>
      overrideGradeDomain(assessmentId, {
        domain: domainKey,
        new_rating: newRating!,
        reason,
      }),
    onSuccess: () => {
      setOverriding(false);
      queryClient.invalidateQueries({ queryKey: ["grade"] });
    },
  });

  if (!data) {
    return (
      <Card withBorder p="xs">
        <Text size="sm" c="dimmed">
          {label}: Not assessed
        </Text>
      </Card>
    );
  }

  const rating = data.rating;
  const color = RATING_COLORS[rating] || "gray";

  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb={4}>
        <Group gap="xs">
          <Text size="sm" fw={600}>
            {label}
          </Text>
          <Badge color={color} size="sm" variant="light">
            {RATING_LABELS[rating] || rating}
          </Badge>
          {data.overridden && (
            <Badge color="blue" size="xs" variant="outline">
              Overridden
            </Badge>
          )}
        </Group>

        <Group gap={4}>
          {data.source_locations && data.source_locations.length > 0 && (
            <ActionIcon
              variant="subtle"
              color="yellow"
              size="sm"
              onClick={() =>
                setActiveHighlights(data.source_locations!, `grade.${domainKey}`)
              }
              title="Highlight in PDF"
            >
              <IconHighlight size={14} />
            </ActionIcon>
          )}
          <Button
            variant="subtle"
            size="xs"
            onClick={() => setOverriding(!overriding)}
          >
            Override
          </Button>
        </Group>
      </Group>

      <Text size="xs" c="dimmed">
        {data.rationale}
      </Text>

      {overriding && (
        <Stack gap="xs" mt="sm" p="xs" bg="gray.0" style={{ borderRadius: 4 }}>
          <Select
            label="New Rating"
            size="xs"
            data={[
              { value: "no_serious", label: "No Serious" },
              { value: "serious", label: "Serious" },
              { value: "very_serious", label: "Very Serious" },
            ]}
            value={newRating}
            onChange={setNewRating}
          />
          <Textarea
            label="Reason for override"
            size="xs"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            minRows={2}
          />
          <Group gap="xs">
            <Button
              size="xs"
              onClick={() => overrideMutation.mutate()}
              loading={overrideMutation.isPending}
              disabled={!newRating || !reason}
            >
              Apply Override
            </Button>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setOverriding(false)}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      )}
    </Card>
  );
}
