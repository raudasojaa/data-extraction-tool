export interface SourceLocation {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

export interface ExtractedField {
  value: unknown;
  confidence: "high" | "medium" | "low" | null;
  missing_reason:
    | "not_reported"
    | "explicitly_absent"
    | "not_applicable"
    | "unclear"
    | null;
  quotes: string[];
}

export interface CompletenessSummary {
  total_fields: number;
  extracted: number;
  missing: number;
  low_confidence: number;
  medium_confidence: number;
  high_confidence: number;
  by_section: Record<
    string,
    { total: number; extracted: number; missing: number; low_confidence: number }
  >;
  missing_reasons: {
    not_reported: number;
    explicitly_absent: number;
    not_applicable: number;
    unclear: number;
  };
}

export interface ValidationWarning {
  field_path: string;
  severity: "warning" | "error";
  check_name: string;
  message: string;
}

export interface ReviewStatus {
  status: "verified" | "needs_review" | "pending";
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface SynthesisData {
  key_findings: string;
  certainty_of_evidence: string;
  strengths: string;
  limitations: string;
  clinical_implications: string;
  raw_text: string;
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
  completeness_summary: CompletenessSummary | null;
  validation_warnings: ValidationWarning[] | null;
  field_review_status: Record<string, ReviewStatus> | null;
  synthesis: SynthesisData | null;
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
