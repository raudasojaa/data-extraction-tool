import { useState } from "react";
import {
  Box,
  Text,
  TextInput,
  Textarea,
  Group,
  ActionIcon,
  Tooltip,
  Badge,
  Popover,
} from "@mantine/core";
import {
  IconPencil,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconCircleCheck,
  IconQuestionMark,
  IconHistory,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitCorrection } from "@/api/extractions";
import type {
  ExtractedField,
  ValidationWarning,
  ReviewStatus,
  Correction,
} from "@/types/extraction";

interface EditableFieldProps {
  fieldKey: string;
  label: string;
  value: unknown;
  extractionId: string;
  validationWarnings?: ValidationWarning[];
  reviewStatus?: ReviewStatus;
  corrections?: Correction[];
  onReviewStatusChange?: (status: "verified" | "needs_review" | "pending") => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "green",
  medium: "yellow",
  low: "red",
};

const MISSING_LABELS: Record<string, { text: string; color: string; style?: string }> = {
  not_reported: { text: "Not reported in article", color: "gray" },
  explicitly_absent: { text: "Authors state not measured", color: "gray", style: "italic" },
  not_applicable: { text: "Not applicable for study design", color: "gray", style: "line-through" },
  unclear: { text: "Information unclear — review needed", color: "yellow" },
};

const REVIEW_ICONS = {
  verified: { icon: IconCircleCheck, color: "green", label: "Verified" },
  needs_review: { icon: IconQuestionMark, color: "yellow", label: "Needs review" },
  pending: { icon: IconCircleCheck, color: "gray", label: "Pending review" },
};

export function EditableField({
  fieldKey,
  label,
  value,
  extractionId,
  validationWarnings = [],
  reviewStatus,
  corrections = [],
  onReviewStatusChange,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const queryClient = useQueryClient();

  // Extract metadata from new format
  const fieldData = extractFieldData(value);
  const displayValue = formatValue(fieldData.value);
  const hasCorrectionHistory = corrections.length > 0;

  const correctionMutation = useMutation({
    mutationFn: () =>
      submitCorrection(extractionId, {
        field_path: fieldKey,
        original_value: { value: fieldData.value },
        corrected_value: { value: editValue },
        correction_type: "value_change",
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["extraction"] });
    },
  });

  const cycleReviewStatus = () => {
    if (!onReviewStatusChange) return;
    const order: Array<"pending" | "needs_review" | "verified"> = [
      "pending",
      "needs_review",
      "verified",
    ];
    const current = reviewStatus?.status || "pending";
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    onReviewStatusChange(next);
  };

  if (editing) {
    const isLong = displayValue.length > 100;
    return (
      <Box>
        <Text size="xs" c="dimmed" tt="capitalize">
          {label}
        </Text>
        {isLong ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={6}
            size="xs"
          />
        ) : (
          <TextInput
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            size="xs"
          />
        )}
        <Group gap={4} mt={4}>
          <ActionIcon
            size="xs"
            color="green"
            onClick={() => correctionMutation.mutate()}
            loading={correctionMutation.isPending}
          >
            <IconCheck size={12} />
          </ActionIcon>
          <ActionIcon
            size="xs"
            color="gray"
            onClick={() => setEditing(false)}
          >
            <IconX size={12} />
          </ActionIcon>
        </Group>
      </Box>
    );
  }

  // Missing value display
  if (fieldData.value === null || fieldData.value === undefined) {
    const missing = MISSING_LABELS[fieldData.missing_reason || "not_reported"] ||
      MISSING_LABELS.not_reported;
    return (
      <Box
        style={hasCorrectionHistory ? { borderLeft: "3px solid #228be6", paddingLeft: 8 } : undefined}
      >
        <Group gap={4} align="flex-start">
          <Box style={{ flex: 1 }}>
            <Text size="xs" c="dimmed" tt="capitalize">
              {label}
            </Text>
            <Text
              size="sm"
              c={missing.color}
              fs={missing.style === "italic" ? "italic" : undefined}
              td={missing.style === "line-through" ? "line-through" : undefined}
            >
              {missing.text}
            </Text>
          </Box>
          <FieldActions
            displayValue=""
            onEdit={() => {
              setEditValue("");
              setEditing(true);
            }}
            reviewStatus={reviewStatus}
            onCycleReview={cycleReviewStatus}
            hasCorrectionHistory={hasCorrectionHistory}
            corrections={corrections}
            validationWarnings={validationWarnings}
          />
        </Group>
      </Box>
    );
  }

  return (
    <Box
      style={hasCorrectionHistory ? { borderLeft: "3px solid #228be6", paddingLeft: 8 } : undefined}
    >
      <Group gap={4} align="flex-start">
        <Box style={{ flex: 1 }}>
          <Group gap={4} align="center">
            <Text size="xs" c="dimmed" tt="capitalize">
              {label}
            </Text>
            {fieldData.confidence && (
              <Tooltip label={`${fieldData.confidence} confidence`}>
                <Box
                  w={8}
                  h={8}
                  style={{
                    borderRadius: "50%",
                    backgroundColor:
                      `var(--mantine-color-${CONFIDENCE_COLORS[fieldData.confidence]}-5)`,
                  }}
                />
              </Tooltip>
            )}
            {validationWarnings.length > 0 && (
              <Tooltip
                label={validationWarnings.map((w) => w.message).join("; ")}
                multiline
                w={300}
              >
                <IconAlertTriangle
                  size={14}
                  color={
                    validationWarnings.some((w) => w.severity === "error")
                      ? "var(--mantine-color-red-6)"
                      : "var(--mantine-color-yellow-6)"
                  }
                />
              </Tooltip>
            )}
          </Group>
          <Text size="sm">{displayValue}</Text>
        </Box>
        <FieldActions
          displayValue={displayValue}
          onEdit={() => {
            setEditValue(displayValue);
            setEditing(true);
          }}
          reviewStatus={reviewStatus}
          onCycleReview={cycleReviewStatus}
          hasCorrectionHistory={hasCorrectionHistory}
          corrections={corrections}
          validationWarnings={validationWarnings}
        />
      </Group>
    </Box>
  );
}

function FieldActions({
  displayValue,
  onEdit,
  reviewStatus,
  onCycleReview,
  hasCorrectionHistory,
  corrections,
}: {
  displayValue: string;
  onEdit: () => void;
  reviewStatus?: ReviewStatus;
  onCycleReview: () => void;
  hasCorrectionHistory: boolean;
  corrections: Correction[];
  validationWarnings: ValidationWarning[];
}) {
  const review = REVIEW_ICONS[reviewStatus?.status || "pending"];
  const ReviewIcon = review.icon;

  return (
    <Group gap={2}>
      {/* Review status toggle */}
      <Tooltip label={review.label}>
        <ActionIcon
          variant="subtle"
          size="xs"
          color={review.color}
          onClick={onCycleReview}
        >
          <ReviewIcon size={12} />
        </ActionIcon>
      </Tooltip>

      {/* Correction history */}
      {hasCorrectionHistory && (
        <Popover width={300} position="left" withArrow>
          <Popover.Target>
            <ActionIcon variant="subtle" size="xs" color="blue">
              <IconHistory size={12} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="xs" fw={600} mb={4}>
              Correction History
            </Text>
            {corrections.map((c) => (
              <Box key={c.id} mb={4}>
                <Text size="xs" td="line-through" c="dimmed">
                  {formatValue(
                    typeof c.original_value === "object" && c.original_value !== null
                      ? (c.original_value as Record<string, unknown>).value
                      : c.original_value
                  )}
                </Text>
                <Text size="xs" c="blue">
                  {formatValue(
                    typeof c.corrected_value === "object" && c.corrected_value !== null
                      ? (c.corrected_value as Record<string, unknown>).value
                      : c.corrected_value
                  )}
                </Text>
                {c.rationale && (
                  <Text size="xs" c="dimmed" fs="italic">
                    {c.rationale}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  {new Date(c.created_at).toLocaleDateString()}
                </Text>
              </Box>
            ))}
          </Popover.Dropdown>
        </Popover>
      )}

      {/* Edit button */}
      <Tooltip label="Edit this field">
        <ActionIcon variant="subtle" size="xs" onClick={onEdit}>
          <IconPencil size={12} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function extractFieldData(value: unknown): {
  value: unknown;
  confidence: string | null;
  missing_reason: string | null;
} {
  // Handle new format: {value, confidence, missing_reason, quotes}
  if (
    typeof value === "object" &&
    value !== null &&
    "value" in (value as Record<string, unknown>)
  ) {
    const v = value as Record<string, unknown>;
    return {
      value: v.value,
      confidence: (v.confidence as string) || null,
      missing_reason: (v.missing_reason as string) || null,
    };
  }
  // Legacy format: plain value
  return { value, confidence: null, missing_reason: null };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "Not reported";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.map((v) => formatValue(v)).join(", ");
  }
  if (typeof value === "object") {
    // Skip rendering internal metadata keys
    const filtered = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        ([k]) => !["confidence", "missing_reason", "quotes", "source_locations"].includes(k)
      )
    );
    if (Object.keys(filtered).length === 0) return "Not reported";
    return JSON.stringify(filtered, null, 2);
  }
  return String(value);
}
