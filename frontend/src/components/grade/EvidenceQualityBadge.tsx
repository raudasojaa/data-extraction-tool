import { Badge } from "@mantine/core";

interface EvidenceQualityBadgeProps {
  certainty: string | null;
}

const CERTAINTY_CONFIG: Record<string, { color: string; label: string }> = {
  high: { color: "green", label: "HIGH" },
  moderate: { color: "yellow", label: "MODERATE" },
  low: { color: "orange", label: "LOW" },
  very_low: { color: "red", label: "VERY LOW" },
};

export function EvidenceQualityBadge({ certainty }: EvidenceQualityBadgeProps) {
  const config = CERTAINTY_CONFIG[certainty || ""] || {
    color: "gray",
    label: certainty?.toUpperCase() || "N/A",
  };

  return (
    <Badge color={config.color} size="lg" variant="filled">
      {config.label}
    </Badge>
  );
}
