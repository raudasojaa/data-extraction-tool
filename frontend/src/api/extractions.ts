import api from "./client";
import type { Extraction, Correction } from "@/types/extraction";
import type { GradeAssessment } from "@/types/grade";

export async function triggerExtraction(
  articleId: string,
  templateId?: string
) {
  const { data } = await api.post<Extraction>(
    `/articles/${articleId}/extract`,
    templateId ? { extraction_template_id: templateId } : {}
  );
  return data;
}

export async function getExtraction(extractionId: string) {
  const { data } = await api.get<Extraction>(`/extractions/${extractionId}`);
  return data;
}

export async function listExtractions(articleId: string) {
  const { data } = await api.get<Extraction[]>(
    `/articles/${articleId}/extractions`
  );
  return data;
}

export async function updateExtraction(
  extractionId: string,
  updates: Partial<Extraction>
) {
  const { data } = await api.put<Extraction>(
    `/extractions/${extractionId}`,
    updates
  );
  return data;
}

export async function submitCorrection(
  extractionId: string,
  correction: {
    field_path: string;
    original_value?: unknown;
    corrected_value?: unknown;
    correction_type?: string;
    rationale?: string;
  }
) {
  const { data } = await api.post<Correction>(
    `/extractions/${extractionId}/corrections`,
    correction
  );
  return data;
}

export async function listCorrections(extractionId: string) {
  const { data } = await api.get<Correction[]>(
    `/extractions/${extractionId}/corrections`
  );
  return data;
}

export async function triggerGradeAssessment(extractionId: string) {
  const { data } = await api.post<GradeAssessment[]>(
    `/extractions/${extractionId}/grade`
  );
  return data;
}

export async function getGradeAssessments(extractionId: string) {
  const { data } = await api.get<GradeAssessment[]>(
    `/extractions/${extractionId}/grade`
  );
  return data;
}

export async function overrideGradeDomain(
  assessmentId: string,
  override: { domain: string; new_rating: string; reason: string }
) {
  const { data } = await api.put<GradeAssessment>(
    `/grade-assessments/${assessmentId}`,
    override
  );
  return data;
}

export async function exportExtractionWord(extractionId: string) {
  const response = await api.post(
    `/export/extractions/${extractionId}/word`,
    {},
    { responseType: "blob" }
  );
  return response.data;
}

export async function exportProjectWord(projectId: string) {
  const response = await api.post(
    `/export/projects/${projectId}/word`,
    {},
    { responseType: "blob" }
  );
  return response.data;
}
