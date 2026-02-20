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
  | "grade";

export const CATEGORY_COLORS: Record<HighlightCategory, string> = {
  study_design: "#6366f1",
  population: "#3b82f6",
  intervention: "#22c55e",
  comparator: "#f59e0b",
  outcomes: "#ef4444",
  setting: "#8b5cf6",
  grade: "#ec4899",
};
