import { useParams } from "react-router-dom";
import { Box, Tabs, Title, Text, Group, Loader } from "@mantine/core";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getArticle, getArticlePdfUrl } from "@/api/articles";
import {
  listExtractions,
  listCorrections,
  triggerExtraction,
  triggerGradeAssessment,
  triggerSynthesis,
  getGradeAssessments,
  exportExtractionWord,
  updateReviewStatus,
} from "@/api/extractions";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { ExtractionPanel } from "@/components/extraction/ExtractionPanel";
import { GradeAssessmentPanel } from "@/components/grade/GradeAssessmentPanel";
import { SynthesisPanel } from "@/components/synthesis/SynthesisPanel";
import { useExtractionStore } from "@/store/extractionStore";
import { notifications } from "@mantine/notifications";

export function ArticleWorkspacePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const queryClient = useQueryClient();
  const selectedTab = useExtractionStore((s) => s.selectedTab);
  const setSelectedTab = useExtractionStore((s) => s.setSelectedTab);

  const { data: article, isLoading: articleLoading } = useQuery({
    queryKey: ["article", articleId],
    queryFn: () => getArticle(articleId!),
    enabled: !!articleId,
  });

  const { data: extractions, isLoading: extractionsLoading } = useQuery({
    queryKey: ["extractions", articleId],
    queryFn: () => listExtractions(articleId!),
    enabled: !!articleId,
  });

  const latestExtraction = extractions?.[0] || null;

  const { data: corrections = [] } = useQuery({
    queryKey: ["corrections", latestExtraction?.id],
    queryFn: () => listCorrections(latestExtraction!.id),
    enabled: !!latestExtraction?.id,
  });

  const { data: gradeAssessments = [], isLoading: gradeLoading } = useQuery({
    queryKey: ["grade", latestExtraction?.id],
    queryFn: () => getGradeAssessments(latestExtraction!.id),
    enabled: !!latestExtraction?.id,
  });

  const extractMutation = useMutation({
    mutationFn: () => triggerExtraction(articleId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extractions", articleId] });
      notifications.show({
        title: "Extraction complete",
        message: "Data has been extracted from the article.",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Extraction failed",
        message: "Could not extract data. Please try again.",
        color: "red",
      });
    },
  });

  const gradeMutation = useMutation({
    mutationFn: () => triggerGradeAssessment(latestExtraction!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["grade", latestExtraction?.id],
      });
      notifications.show({
        title: "GRADE assessment complete",
        message: "Evidence certainty has been assessed.",
        color: "green",
      });
    },
  });

  const synthesisMutation = useMutation({
    mutationFn: () => triggerSynthesis(latestExtraction!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["extractions", articleId],
      });
      notifications.show({
        title: "Synthesis complete",
        message: "Evidence synthesis has been generated.",
        color: "green",
      });
    },
    onError: () => {
      notifications.show({
        title: "Synthesis failed",
        message: "Could not generate synthesis. Please try again.",
        color: "red",
      });
    },
  });

  const reviewStatusMutation = useMutation({
    mutationFn: ({
      fieldPath,
      status,
    }: {
      fieldPath: string;
      status: "verified" | "needs_review" | "pending";
    }) => updateReviewStatus(latestExtraction!.id, fieldPath, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extractions", articleId] });
    },
  });

  const handleReviewStatusChange = (
    fieldPath: string,
    status: "verified" | "needs_review" | "pending"
  ) => {
    reviewStatusMutation.mutate({ fieldPath, status });
  };

  const handleExport = async () => {
    if (!latestExtraction) return;
    try {
      const blob = await exportExtractionWord(latestExtraction.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${article?.title || "extraction"}.docx`;
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

  if (articleLoading) {
    return (
      <Box p="xl" ta="center">
        <Loader />
      </Box>
    );
  }

  if (!article) {
    return (
      <Box p="xl">
        <Text>Article not found.</Text>
      </Box>
    );
  }

  return (
    <Box h="calc(100vh - 60px)">
      <Group px="md" py="xs" bg="white" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div>
          <Title order={5} lineClamp={1}>
            {article.title || "Untitled Article"}
          </Title>
          <Text size="xs" c="dimmed">
            {article.authors} | {article.journal} ({article.year})
          </Text>
        </div>
      </Group>

      <PanelGroup direction="horizontal" style={{ height: "calc(100% - 52px)" }}>
        {/* Left panel: PDF viewer */}
        <Panel defaultSize={50} minSize={30}>
          <PdfViewer
            pdfUrl={getArticlePdfUrl(articleId!)}
            loading={articleLoading}
          />
        </Panel>

        <PanelResizeHandle
          style={{
            width: 6,
            backgroundColor: "#e5e7eb",
            cursor: "col-resize",
          }}
        />

        {/* Right panel: Extraction / GRADE / Synthesis */}
        <Panel defaultSize={50} minSize={30}>
          <Box h="100%" style={{ overflow: "auto" }}>
            <Tabs
              value={selectedTab}
              onChange={(v) => setSelectedTab(v || "extraction")}
            >
              <Tabs.List>
                <Tabs.Tab value="extraction">Extraction</Tabs.Tab>
                <Tabs.Tab value="grade">GRADE</Tabs.Tab>
                <Tabs.Tab value="synthesis">Synthesis</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="extraction">
                <ExtractionPanel
                  extraction={latestExtraction}
                  loading={extractionsLoading}
                  extractionLoading={extractMutation.isPending}
                  onReExtract={() => extractMutation.mutate()}
                  onExport={handleExport}
                  corrections={corrections}
                  onReviewStatusChange={handleReviewStatusChange}
                />
              </Tabs.Panel>

              <Tabs.Panel value="grade">
                <GradeAssessmentPanel
                  assessments={gradeAssessments}
                  loading={gradeLoading}
                  gradeLoading={gradeMutation.isPending}
                  onRunGrade={() => gradeMutation.mutate()}
                />
              </Tabs.Panel>

              <Tabs.Panel value="synthesis">
                <SynthesisPanel
                  synthesis={latestExtraction?.synthesis || null}
                  loading={synthesisMutation.isPending}
                  onGenerateSynthesis={() => synthesisMutation.mutate()}
                  hasExtraction={!!latestExtraction}
                />
              </Tabs.Panel>
            </Tabs>
          </Box>
        </Panel>
      </PanelGroup>
    </Box>
  );
}
