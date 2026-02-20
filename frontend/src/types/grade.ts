export interface GradeAssessment {
  id: string;
  extraction_id: string;
  outcome_name: string;
  risk_of_bias: GradeDomain | null;
  inconsistency: GradeDomain | null;
  indirectness: GradeDomain | null;
  imprecision: GradeDomain | null;
  publication_bias: GradeDomain | null;
  large_effect: GradeUpgradeFactor | null;
  dose_response: GradeUpgradeFactor | null;
  residual_confounding: GradeUpgradeFactor | null;
  overall_certainty: string | null;
  overall_rationale: string | null;
  is_overridden: boolean;
  overridden_by: string | null;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface GradeDomain {
  rating: "no_serious" | "serious" | "very_serious";
  rationale: string;
  quotes?: string[];
  source_locations?: Array<{
    page: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    text: string;
  }>;
  [key: string]: unknown;
}

export interface GradeUpgradeFactor {
  applicable: boolean;
  rationale: string;
  quotes?: string[];
}

export type CertaintyLevel = "high" | "moderate" | "low" | "very_low";
