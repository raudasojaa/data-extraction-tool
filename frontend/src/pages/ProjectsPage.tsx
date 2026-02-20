import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  ActionIcon,
} from "@mantine/core";
import { IconPlus, IconEye, IconTrash } from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  extraction_template_id: string | null;
  created_at: string;
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await api.get<Project[]>("/projects/");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Project>("/projects/", {
        name,
        description: description || null,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setCreateOpen(false);
      setName("");
      setDescription("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Projects</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateOpen(true)}
        >
          New Project
        </Button>
      </Group>

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center">
                    Loading...
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : projects.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center">
                    No projects yet. Create one to group articles together.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              projects.map((project) => (
                <Table.Tr
                  key={project.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <Table.Td>
                    <Text fw={500}>{project.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {project.description || "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(project.created_at).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}`);
                        }}
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(project.id);
                        }}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Project"
      >
        <Stack>
          <TextInput
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Button
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!name.trim()}
          >
            Create Project
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
}
