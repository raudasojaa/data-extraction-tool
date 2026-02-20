import { useRef } from "react";
import {
  Box,
  Button,
  Card,
  FileButton,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Badge,
  ActionIcon,
  SimpleGrid,
} from "@mantine/core";
import {
  IconUpload,
  IconTrash,
  IconDatabase,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";

interface TrainingExample {
  id: string;
  source_type: string;
  input_text: string;
  expected_output: Record<string, unknown>;
  study_type: string | null;
  quality_score: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

interface TrainingStats {
  total_examples: number;
  active_examples: number;
  by_source_type: Record<string, number>;
  by_study_type: Record<string, number>;
  avg_quality_score: number;
}

export function TrainingPage() {
  const queryClient = useQueryClient();
  const resetRef = useRef<() => void>(null);

  const { data: examples = [], isLoading } = useQuery({
    queryKey: ["training-examples"],
    queryFn: async () => {
      const { data } = await api.get<TrainingExample[]>("/training/examples");
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["training-stats"],
    queryFn: async () => {
      const { data } = await api.get<TrainingStats>("/training/stats");
      return data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/training/import-word-doc", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
      queryClient.invalidateQueries({ queryKey: ["training-stats"] });
      resetRef.current?.();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/training/examples/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
      queryClient.invalidateQueries({ queryKey: ["training-stats"] });
    },
  });

  const SOURCE_COLORS: Record<string, string> = {
    imported_word_doc: "blue",
    corrected_extraction: "green",
    manual: "violet",
  };

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Training Data</Title>
        <FileButton
          resetRef={resetRef}
          onChange={(file) => file && importMutation.mutate(file)}
          accept=".docx,.doc"
        >
          {(props) => (
            <Button
              {...props}
              leftSection={<IconUpload size={16} />}
              loading={importMutation.isPending}
            >
              Import Word Document
            </Button>
          )}
        </FileButton>
      </Group>

      {/* Stats cards */}
      {stats && (
        <SimpleGrid cols={4} mb="lg">
          <Card withBorder p="md">
            <Text c="dimmed" size="xs">
              Total Examples
            </Text>
            <Text size="xl" fw={700}>
              {stats.total_examples}
            </Text>
          </Card>
          <Card withBorder p="md">
            <Text c="dimmed" size="xs">
              Active
            </Text>
            <Text size="xl" fw={700}>
              {stats.active_examples}
            </Text>
          </Card>
          <Card withBorder p="md">
            <Text c="dimmed" size="xs">
              Avg Quality Score
            </Text>
            <Text size="xl" fw={700}>
              {stats.avg_quality_score.toFixed(2)}
            </Text>
          </Card>
          <Card withBorder p="md">
            <Text c="dimmed" size="xs">
              Source Types
            </Text>
            <Group gap={4} mt={4}>
              {Object.entries(stats.by_source_type).map(([type, count]) => (
                <Badge
                  key={type}
                  color={SOURCE_COLORS[type] || "gray"}
                  size="sm"
                >
                  {type}: {count}
                </Badge>
              ))}
            </Group>
          </Card>
        </SimpleGrid>
      )}

      {/* Examples table */}
      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Source</Table.Th>
              <Table.Th>Study Type</Table.Th>
              <Table.Th>Input Preview</Table.Th>
              <Table.Th>Quality</Table.Th>
              <Table.Th>Uses</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center">
                    Loading...
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : examples.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center">
                    <IconDatabase size={20} style={{ marginRight: 8 }} />
                    No training examples yet. Import Word documents or make
                    corrections to build your training data.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              examples.map((example) => (
                <Table.Tr key={example.id}>
                  <Table.Td>
                    <Badge
                      color={SOURCE_COLORS[example.source_type] || "gray"}
                      size="sm"
                    >
                      {example.source_type.replace(/_/g, " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{example.study_type || "N/A"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" lineClamp={2} maw={300}>
                      {example.input_text.substring(0, 200)}...
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{example.quality_score.toFixed(2)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{example.usage_count}</Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => deleteMutation.mutate(example.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Box>
  );
}
