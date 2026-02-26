export interface Highlight {
  id: string;
  position: {
    boundingRect: BoundingRect;
    rects: BoundingRect[];
    pageNumber: number;
  };
  content: {
    text: string;
  };
  comment: {
    text: string;
    category: string;
  };
}

export interface BoundingRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
}

export type HighlightCategory =
  | "study_design"
  | "population"
  | "intervention"
  | "comparator"
  | "outcomes"
  | "setting"
  | "follow_up"
  | "funding"
  | "limitations"
  | "conclusions"
  | "custom_fields"
  | "grade";

export const CATEGORY_COLORS: Record<HighlightCategory, string> = {
  study_design: "#6366f1",
  population: "#3b82f6",
  intervention: "#22c55e",
  comparator: "#f59e0b",
  outcomes: "#ef4444",
  setting: "#8b5cf6",
  follow_up: "#14b8a6",
  funding: "#a855f7",
  limitations: "#f97316",
  conclusions: "#06b6d4",
  custom_fields: "#6b7280",
  grade: "#ec4899",
};
