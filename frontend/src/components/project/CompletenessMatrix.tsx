import { Box, Text, Table, Badge, Tooltip, Loader } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { getProjectCompleteness } from "@/api/extractions";

interface CompletenessMatrixProps {
  projectId: string;
}

const SECTIONS = [
  "study_design",
  "population",
  "intervention",
  "comparator",
  "outcomes",
  "setting",
  "follow_up",
  "funding",
  "limitations",
  "conclusions",
];

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "green",
  medium: "yellow",
  low: "red",
};

interface ArticleCompleteness {
  article_id: string;
  title: string;
  status: string;
  completeness: {
    total_fields: number;
    extracted: number;
    missing: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    by_section: Record<
      string,
      { total: number; extracted: number; missing: number; low_confidence: number }
    >;
  } | null;
  validation_warnings_count: number;
}

export function CompletenessMatrix({ projectId }: CompletenessMatrixProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-completeness", projectId],
    queryFn: () => getProjectCompleteness(projectId),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <Box p="md" ta="center">
        <Loader size="sm" />
      </Box>
    );
  }

  const articles: ArticleCompleteness[] = data?.articles || [];

  if (articles.length === 0) {
    return null;
  }

  return (
    <Box style={{ overflowX: "auto" }}>
      <Text fw={600} size="sm" mb="xs">
        Extraction Completeness Matrix
      </Text>
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ minWidth: 180 }}>Article</Table.Th>
            {SECTIONS.map((s) => (
              <Table.Th key={s} style={{ minWidth: 60, textAlign: "center" }}>
                <Text size="xs" tt="capitalize">
                  {s.replace(/_/g, " ")}
                </Text>
              </Table.Th>
            ))}
            <Table.Th style={{ textAlign: "center" }}>
              <Text size="xs">Warnings</Text>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {articles.map((article) => (
            <Table.Tr key={article.article_id}>
              <Table.Td>
                <Text size="xs" lineClamp={1}>
                  {article.title}
                </Text>
              </Table.Td>
              {SECTIONS.map((section) => {
                const sectionData = article.completeness?.by_section?.[section];
                if (!sectionData) {
                  return (
                    <Table.Td key={section} style={{ textAlign: "center" }}>
                      <Tooltip label="No data">
                        <Box
                          w={16}
                          h={16}
                          mx="auto"
                          style={{
                            borderRadius: 3,
                            backgroundColor: "#e5e7eb",
                          }}
                        />
                      </Tooltip>
                    </Table.Td>
                  );
                }
                const pct = sectionData.total > 0
                  ? Math.round((sectionData.extracted / sectionData.total) * 100)
                  : 0;
                const color = pct === 100
                  ? sectionData.low_confidence > 0
                    ? "yellow"
                    : "green"
                  : pct > 0
                    ? "orange"
                    : "red";
                return (
                  <Table.Td key={section} style={{ textAlign: "center" }}>
                    <Tooltip
                      label={`${sectionData.extracted}/${sectionData.total} fields${sectionData.low_confidence > 0 ? ` (${sectionData.low_confidence} low confidence)` : ""}`}
                    >
                      <Box
                        w={16}
                        h={16}
                        mx="auto"
                        style={{
                          borderRadius: 3,
                          backgroundColor: `var(--mantine-color-${color}-${pct === 100 && color === "green" ? "5" : "4"})`,
                        }}
                      />
                    </Tooltip>
                  </Table.Td>
                );
              })}
              <Table.Td style={{ textAlign: "center" }}>
                {article.validation_warnings_count > 0 ? (
                  <Badge size="xs" color="red" variant="light">
                    {article.validation_warnings_count}
                  </Badge>
                ) : (
                  <Badge size="xs" color="green" variant="light">
                    0
                  </Badge>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
