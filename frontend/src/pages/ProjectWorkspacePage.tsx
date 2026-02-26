import { useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  FileButton,
  Group,
  Loader,
  NavLink,
  Stack,
  Text,
  Title,
  Badge,
} from "@mantine/core";
import {
  IconUpload,
  IconDownload,
  IconPlayerPlay,
  IconFileText,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { uploadArticle } from "@/api/articles";
import { exportProjectWord } from "@/api/extractions";
import { notifications } from "@mantine/notifications";
import type { Article } from "@/types/article";
import { CompletenessMatrix } from "@/components/project/CompletenessMatrix";

interface Project {
  id: string;
  name: string;
  description: string | null;
}

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resetRef = useRef<() => void>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await api.get<Project>(`/projects/${projectId}`);
      return data;
    },
    enabled: !!projectId,
  });

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["project-articles", projectId],
    queryFn: async () => {
      const { data } = await api.get<Article[]>(
        `/projects/${projectId}/articles`
      );
      return data;
    },
    enabled: !!projectId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadArticle(file, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-articles", projectId],
      });
      resetRef.current?.();
    },
  });

  const batchExtractMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(
        `/projects/${projectId}/extract-all`
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["project-articles", projectId],
      });
      notifications.show({
        title: "Batch extraction complete",
        message: `Processed ${data.results?.length || 0} articles.`,
        color: "green",
      });
    },
  });

  const handleExportProject = async () => {
    try {
      const blob = await exportProjectWord(projectId!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name || "project"}_report.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      notifications.show({
        title: "Export failed",
        message: "Could not generate Word document.",
        color: "red",
      });
    }
  };

  if (projectLoading) {
    return (
      <Box p="xl" ta="center">
        <Loader />
      </Box>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    uploaded: "blue",
    processing: "yellow",
    extracted: "green",
    reviewed: "teal",
  };

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>{project?.name}</Title>
          {project?.description && (
            <Text size="sm" c="dimmed">
              {project.description}
            </Text>
          )}
        </div>
        <Group>
          <FileButton
            resetRef={resetRef}
            onChange={(file) => file && uploadMutation.mutate(file)}
            accept="application/pdf"
          >
            {(props) => (
              <Button
                {...props}
                variant="outline"
                leftSection={<IconUpload size={16} />}
                loading={uploadMutation.isPending}
              >
                Add Article
              </Button>
            )}
          </FileButton>
          <Button
            variant="outline"
            leftSection={<IconPlayerPlay size={16} />}
            loading={batchExtractMutation.isPending}
            onClick={() => batchExtractMutation.mutate()}
            disabled={articles.length === 0}
          >
            Extract All
          </Button>
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={handleExportProject}
            disabled={articles.length === 0}
          >
            Export All to Word
          </Button>
        </Group>
      </Group>

      {articles.length > 0 && (
        <Card withBorder mb="lg">
          <CompletenessMatrix projectId={projectId!} />
        </Card>
      )}

      <Card withBorder>
        <Title order={5} mb="sm">
          Articles ({articles.length})
        </Title>

        {articlesLoading ? (
          <Text c="dimmed">Loading...</Text>
        ) : articles.length === 0 ? (
          <Text c="dimmed">
            No articles in this project. Upload PDFs to get started.
          </Text>
        ) : (
          <Stack gap={4}>
            {articles.map((article) => (
              <NavLink
                key={article.id}
                label={article.title || "Untitled"}
                description={`${article.authors || "N/A"} (${article.year || "N/A"})`}
                leftSection={<IconFileText size={18} />}
                rightSection={
                  <Badge
                    color={STATUS_COLORS[article.status] || "gray"}
                    size="sm"
                  >
                    {article.status}
                  </Badge>
                }
                onClick={() => navigate(`/articles/${article.id}`)}
              />
            ))}
          </Stack>
        )}
      </Card>
    </Box>
  );
}
