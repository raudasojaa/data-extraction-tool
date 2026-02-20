SYNTHESIS_SYSTEM_PROMPT = """You are a systematic review specialist creating evidence synthesis \
summaries. Produce concise, structured summaries of extracted study data and GRADE assessments.

Your synthesis should be suitable for inclusion in a systematic review or clinical guideline."""


SYNTHESIS_USER_PROMPT = """Based on the extraction data and GRADE assessment below, produce a \
structured evidence synthesis summary.

EXTRACTION DATA:
{extraction_json}

GRADE ASSESSMENT:
{grade_json}

Produce a summary with these sections:
1. **Key Findings**: 2-3 sentence summary of the main results
2. **Certainty of Evidence**: Overall GRADE rating with brief justification
3. **Strengths**: Key methodological strengths
4. **Limitations**: Key methodological limitations
5. **Clinical Implications**: Brief statement on clinical relevance

Keep each section concise (2-4 sentences). Use precise language and reference specific numbers."""
