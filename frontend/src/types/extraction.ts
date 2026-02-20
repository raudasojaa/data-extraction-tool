export interface SourceLocation {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

export interface Extraction {
  id: string;
  article_id: string;
  version: number;
  status: string;
  study_design: Record<string, unknown> | null;
  population: Record<string, unknown> | null;
  intervention: Record<string, unknown> | null;
  comparator: Record<string, unknown> | null;
  outcomes: Record<string, unknown> | null;
  setting: Record<string, unknown> | null;
  follow_up: Record<string, unknown> | null;
  funding: Record<string, unknown> | null;
  limitations: Record<string, unknown> | null;
  conclusions: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
  extraction_template_id: string | null;
  model_used: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
  updated_at: string;
}

export interface Correction {
  id: string;
  extraction_id: string;
  user_id: string;
  field_path: string;
  original_value: unknown;
  corrected_value: unknown;
  correction_type: string | null;
  rationale: string | null;
  applied_to_training: boolean;
  created_at: string;
}
