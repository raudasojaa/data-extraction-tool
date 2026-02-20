import { useState, useRef } from "react";
import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Badge,
  ActionIcon,
  FileButton,
  TextInput,
} from "@mantine/core";
import {
  IconUpload,
  IconTrash,
  IconEye,
  IconSearch,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listArticles, uploadArticle, deleteArticle } from "@/api/articles";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "blue",
  processing: "yellow",
  extracted: "green",
  reviewed: "teal",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const resetRef = useRef<() => void>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: () => listArticles(),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadArticle(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      resetRef.current?.();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });

  const articles = data?.articles || [];
  const filtered = articles.filter(
    (a) =>
      !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.authors?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Articles</Title>
        <FileButton
          resetRef={resetRef}
          onChange={(file) => file && uploadMutation.mutate(file)}
          accept="application/pdf"
        >
          {(props) => (
            <Button
              {...props}
              leftSection={<IconUpload size={16} />}
              loading={uploadMutation.isPending}
            >
              Upload PDF
            </Button>
          )}
        </FileButton>
      </Group>

      <TextInput
        placeholder="Search articles..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="md"
      />

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Authors</Table.Th>
              <Table.Th>Year</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center">
                    Loading...
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : filtered.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center">
                    No articles found. Upload a PDF to get started.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filtered.map((article) => (
                <Table.Tr
                  key={article.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/articles/${article.id}`)}
                >
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {article.title || "Untitled"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {article.authors || "N/A"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{article.year || "N/A"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLORS[article.status] || "gray"}
                      size="sm"
                    >
                      {article.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/articles/${article.id}`);
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
                          deleteMutation.mutate(article.id);
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

      <Text size="xs" c="dimmed" mt="sm">
        Total: {data?.total || 0} articles
      </Text>
    </Box>
  );
}
