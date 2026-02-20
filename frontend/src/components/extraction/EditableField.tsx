import { useState } from "react";
import {
  Box,
  Text,
  TextInput,
  Textarea,
  Group,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitCorrection } from "@/api/extractions";

interface EditableFieldProps {
  fieldKey: string;
  label: string;
  value: unknown;
  extractionId: string;
}

export function EditableField({
  fieldKey,
  label,
  value,
  extractionId,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const queryClient = useQueryClient();

  const correctionMutation = useMutation({
    mutationFn: () =>
      submitCorrection(extractionId, {
        field_path: fieldKey,
        original_value: { value },
        corrected_value: { value: editValue },
        correction_type: "value_change",
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["extraction"] });
    },
  });

  const displayValue = formatValue(value);

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

  return (
    <Box>
      <Group gap={4} align="flex-start">
        <Box style={{ flex: 1 }}>
          <Text size="xs" c="dimmed" tt="capitalize">
            {label}
          </Text>
          <Text size="sm">{displayValue}</Text>
        </Box>
        <Tooltip label="Edit this field">
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={() => {
              setEditValue(displayValue);
              setEditing(true);
            }}
          >
            <IconPencil size={12} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  );
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
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
