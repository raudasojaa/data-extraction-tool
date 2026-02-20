import { useRef, useState } from "react";
import {
  Accordion,
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
  Tooltip,
} from "@mantine/core";
import {
  IconUpload,
  IconTrash,
  IconUsers,
  IconBook,
  IconTemplate,
  IconStar,
  IconInfoCircle,
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
  {
    value: "grade_handbook",
    label: "GRADE Handbook",
    description: "Used as context during GRADE certainty assessments",
  },
  {
    value: "extraction",
    label: "Extraction Methodology",
    description: "Used as context during data extraction from articles",
  },
  {
    value: "general",
    label: "General Reference",
    description: "Used as context for both extraction and GRADE assessments",
  },
];

function MethodologyReferencesSection({
  queryClient,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const resetRef = useRef<() => void>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<string>("grade_handbook");

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
      formData.append("title", file.name.replace(/\.pdf$/i, ""));
      formData.append("category", selectedCategory);
      const { data } = await api.post("/methodology/references", formData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["methodology-refs"] });
      resetRef.current?.();
      notifications.show({
        title: "Reference uploaded",
        message: "Methodology PDF has been added and is now active.",
        color: "green",
      });
    },
    onError: (error: unknown) => {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (error as { message?: string })?.message ||
        "Upload failed";
      notifications.show({
        title: "Upload failed",
        message: detail,
        color: "red",
      });
      resetRef.current?.();
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

  const categoryInfo = METHODOLOGY_CATEGORIES.find(
    (c) => c.value === selectedCategory
  );

  return (
    <Card withBorder>
      <Group mb="xs">
        <IconBook size={20} />
        <Title order={4}>Methodology References</Title>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Upload PDF guides (e.g. GRADE handbook, Cochrane methods manual).{" "}
        <strong>Active PDFs are automatically included as background context
        for every AI data extraction and GRADE assessment in this workspace.</strong>
      </Text>

      <Group align="flex-end" mb="md" gap="sm">
        <Select
          label="Category"
          size="xs"
          style={{ width: 220 }}
          data={METHODOLOGY_CATEGORIES.map((c) => ({
            value: c.value,
            label: c.label,
          }))}
          value={selectedCategory}
          onChange={(v) => v && setSelectedCategory(v)}
        />
        {categoryInfo && (
          <Tooltip label={categoryInfo.description} withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" mb={2}>
              <IconInfoCircle size={16} />
            </ActionIcon>
          </Tooltip>
        )}
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
              mb={2}
            >
              Upload PDF
            </Button>
          )}
        </FileButton>
      </Group>

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
        message: "Extraction template has been parsed and is ready for use.",
        color: "green",
      });
    },
    onError: (error: unknown) => {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (error as { message?: string })?.message ||
        "Upload failed";
      notifications.show({
        title: "Upload failed",
        message: detail,
        color: "red",
      });
      resetRef.current?.();
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/templates/${id}`, { is_default: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      notifications.show({
        title: "Default template set",
        message: "This template will be used for all new extractions.",
        color: "blue",
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
      <Group justify="space-between" mb="xs">
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

      <Text size="sm" c="dimmed" mb="sm">
        Upload a Word document (.docx) whose headings and tables define the
        fields to extract.{" "}
        <strong>
          Set one as the global default and it will be used for all future data
          extractions.
        </strong>{" "}
        You can also assign a specific template to individual projects from the
        Projects page.
      </Text>

      <Accordion variant="contained" mb="md">
        <Accordion.Item value="format">
          <Accordion.Control
            icon={<IconInfoCircle size={16} />}
            style={{ fontSize: 13 }}
          >
            What format should the Word document use?
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={4}>
              <Text size="sm">
                Structure your Word document like this so the parser can read
                it correctly:
              </Text>
              <Text size="sm">
                • Use <strong>Heading 1</strong> or <strong>Heading 2</strong>{" "}
                styles for section names (e.g. "Population", "Intervention",
                "Outcomes").
              </Text>
              <Text size="sm">
                • Optionally add <strong>tables</strong> under a section: the
                first row is treated as column headers and each subsequent row
                becomes a field to extract.
              </Text>
              <Text size="sm">
                • Normal paragraph text under a heading is used as a field
                description or placeholder.
              </Text>
              <Text size="sm" c="dimmed">
                Example: a heading "Population" with a table whose columns are
                "Age range", "Diagnosis", "Sample size" will produce three
                extraction fields under Population.
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

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
                  {tmpl.is_default ? (
                    <Badge color="blue" size="sm">
                      Default
                    </Badge>
                  ) : (
                    <Tooltip label="Set as global default" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(tmpl.id)}
                        loading={setDefaultMutation.isPending}
                      >
                        <IconStar size={14} />
                      </ActionIcon>
                    </Tooltip>
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
