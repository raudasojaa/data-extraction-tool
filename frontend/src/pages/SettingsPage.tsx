import { useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  Divider,
  FileButton,
  Group,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Badge,
  ActionIcon,
  Select,
} from "@mantine/core";
import {
  IconUpload,
  IconTrash,
  IconUsers,
  IconBook,
  IconTemplate,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, updateUser } from "@/api/auth";
import api from "@/api/client";
import { notifications } from "@mantine/notifications";

interface MethodologyRef {
  id: string;
  title: string;
  description: string | null;
  category: string;
  is_active: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  parsed_schema: Record<string, unknown> | null;
  is_default: boolean;
}

export function SettingsPage() {
  const queryClient = useQueryClient();

  return (
    <Box>
      <Title order={2} mb="lg">
        Settings
      </Title>

      <Stack gap="xl">
        <TrainingContributorsSection queryClient={queryClient} />
        <Divider />
        <MethodologyReferencesSection queryClient={queryClient} />
        <Divider />
        <ExtractionTemplatesSection queryClient={queryClient} />
      </Stack>
    </Box>
  );
}

function TrainingContributorsSection({
  queryClient,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      userId,
      training_contributor,
    }: {
      userId: string;
      training_contributor: boolean;
    }) => updateUser(userId, { training_contributor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  return (
    <Card withBorder>
      <Group mb="md">
        <IconUsers size={20} />
        <Title order={4}>Training Contributors</Title>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Control which users' corrections feed into the shared training pool.
      </Text>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>User</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Training Contributor</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td>{user.full_name}</Table.Td>
              <Table.Td>{user.email}</Table.Td>
              <Table.Td>
                <Badge size="sm">{user.role}</Badge>
              </Table.Td>
              <Table.Td>
                <Switch
                  checked={user.training_contributor}
                  onChange={(e) =>
                    updateMutation.mutate({
                      userId: user.id,
                      training_contributor: e.currentTarget.checked,
                    })
                  }
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

const METHODOLOGY_CATEGORIES = [
  { value: "grade_handbook", label: "GRADE Handbook" },
  { value: "cochrane_methods", label: "Cochrane Methods" },
  { value: "reporting_guideline", label: "Reporting Guideline" },
  { value: "extraction", label: "Extraction Guide" },
];

function MethodologyReferencesSection({
  queryClient,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const resetRef = useRef<() => void>(null);
  const [category, setCategory] = useState<string>("grade_handbook");

  const { data: refs = [] } = useQuery({
    queryKey: ["methodology-refs"],
    queryFn: async () => {
      const { data } = await api.get<MethodologyRef[]>(
        "/methodology/references"
      );
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(".pdf", ""));
      formData.append("category", category);
      const { data } = await api.post("/methodology/references", formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["methodology-refs"] });
      resetRef.current?.();
      notifications.show({
        title: "Reference uploaded",
        message: "Methodology PDF has been added.",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Upload failed",
        message: "Could not upload the methodology reference. Please try again.",
        color: "red",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      await api.put(`/methodology/references/${id}`, { is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["methodology-refs"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/methodology/references/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["methodology-refs"] });
    },
  });

  return (
    <Card withBorder>
      <Group justify="space-between" mb="md">
        <Group>
          <IconBook size={20} />
          <Title order={4}>Methodology References</Title>
        </Group>
        <Group gap="sm">
          <Select
            size="xs"
            data={METHODOLOGY_CATEGORIES}
            value={category}
            onChange={(val) => val && setCategory(val)}
            w={180}
          />
          <FileButton
            resetRef={resetRef}
            onChange={(file) => file && uploadMutation.mutate(file)}
            accept="application/pdf"
          >
            {(props) => (
              <Button
                {...props}
                variant="outline"
                size="xs"
                leftSection={<IconUpload size={14} />}
                loading={uploadMutation.isPending}
              >
                Upload PDF
              </Button>
            )}
          </FileButton>
        </Group>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Upload methodological PDFs (GRADE handbook, Cochrane methods, etc.) to
        be included as context during AI assessments.
      </Text>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Active</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {refs.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text c="dimmed" size="sm" ta="center">
                  No methodology references uploaded yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            refs.map((ref) => (
              <Table.Tr key={ref.id}>
                <Table.Td>{ref.title}</Table.Td>
                <Table.Td>
                  <Badge size="sm">{ref.category}</Badge>
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={ref.is_active}
                    onChange={(e) =>
                      toggleMutation.mutate({
                        id: ref.id,
                        is_active: e.currentTarget.checked,
                      })
                    }
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => deleteMutation.mutate(ref.id)}
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
  );
}

function ExtractionTemplatesSection({
  queryClient,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const resetRef = useRef<() => void>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data } = await api.get<Template[]>("/templates/");
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.(docx|doc)$/i, ""));
      const { data } = await api.post("/templates/", formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      resetRef.current?.();
      notifications.show({
        title: "Template uploaded",
        message:
          "Extraction template has been parsed and is ready for use.",
        color: "green",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  return (
    <Card withBorder>
      <Group justify="space-between" mb="md">
        <Group>
          <IconTemplate size={20} />
          <Title order={4}>Extraction Templates</Title>
        </Group>
        <FileButton
          resetRef={resetRef}
          onChange={(file) => file && uploadMutation.mutate(file)}
          accept=".docx,.doc"
        >
          {(props) => (
            <Button
              {...props}
              variant="outline"
              size="xs"
              leftSection={<IconUpload size={14} />}
              loading={uploadMutation.isPending}
            >
              Upload Template
            </Button>
          )}
        </FileButton>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Upload Word documents that define what data to extract. The document
        structure (headings, tables) will be parsed into an extraction schema.
      </Text>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Sections</Table.Th>
            <Table.Th>Default</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {templates.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text c="dimmed" size="sm" ta="center">
                  No extraction templates uploaded yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            templates.map((tmpl) => (
              <Table.Tr key={tmpl.id}>
                <Table.Td>
                  <Text fw={500}>{tmpl.name}</Text>
                  {tmpl.description && (
                    <Text size="xs" c="dimmed">
                      {tmpl.description}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {tmpl.parsed_schema && (
                    <Text size="sm">
                      {(
                        tmpl.parsed_schema as { sections?: unknown[] }
                      ).sections?.length || 0}{" "}
                      sections,{" "}
                      {(
                        tmpl.parsed_schema as { tables?: unknown[] }
                      ).tables?.length || 0}{" "}
                      tables
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {tmpl.is_default && (
                    <Badge color="blue" size="sm">
                      Default
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => deleteMutation.mutate(tmpl.id)}
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
  );
}
