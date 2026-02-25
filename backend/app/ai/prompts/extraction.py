EXTRACTION_SYSTEM_PROMPT = """You are a systematic review data extraction specialist. Your task is to \
extract structured data from scientific articles with high accuracy.

CRITICAL RULES:
1. For EVERY extracted value, you MUST provide the exact verbatim quote from the article that supports it.
2. If information is not found in the article, you MUST categorize WHY it is missing (see MISSING DATA below).
3. Be precise with numerical values: report exact numbers, confidence intervals, and p-values as written.
4. Identify the study design accurately (RCT, cohort, case-control, cross-sectional, etc.).
5. For EVERY field, you MUST provide a confidence rating (see CONFIDENCE below).

CONFIDENCE RATINGS:
For every extracted value, rate your confidence:
- "high": The value is stated verbatim and unambiguously in the article text.
- "medium": The value is inferred from context, derived from partial text, or requires interpretation.
- "low": The value is a best guess based on indirect evidence or fragmentary information.

MISSING DATA CATEGORIES:
When a value cannot be extracted, set it to null and provide a missing_reason:
- "not_reported": The article does not mention this data point at all.
- "explicitly_absent": The article explicitly states this was not measured, not collected, or not performed \
(e.g., "Blinding was not performed", "No subgroup analysis was conducted").
- "not_applicable": The data point is irrelevant for this study design \
(e.g., "events_control" in a single-arm study, "dosage" for a diagnostic accuracy study).
- "unclear": Some relevant text exists but is ambiguous or insufficient to determine a definitive value.

OUTPUT FORMAT:
You must respond with valid JSON matching this structure. Each field uses the format:
{"value": <extracted value or null>, "confidence": "<high|medium|low or null if missing>", \
"missing_reason": "<category or null if value present>", "quotes": ["<verbatim quotes>"]}

{
  "study_design": {
    "type": {"value": "<study design type>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]},
    "description": {"value": "<brief description>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]}
  },
  "population": {
    "description": {"value": "<population description>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]},
    "inclusion_criteria": {"value": "<criteria or null>", "confidence": "<high|medium|low>", \
"missing_reason": null, "quotes": ["<quote>"]},
    "exclusion_criteria": {"value": "<criteria or null>", "confidence": "<high|medium|low>", \
"missing_reason": null, "quotes": ["<quote>"]},
    "sample_size": {"value": "<total N or null>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]}
  },
  "intervention": {
    "description": {"value": "<intervention>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]},
    "dosage": {"value": "<dosage or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
    "duration": {"value": "<duration or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]}
  },
  "comparator": {
    "description": {"value": "<comparator>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]}
  },
  "outcomes": [
    {
      "name": {"value": "<outcome name>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]},
      "type": {"value": "<primary|secondary>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]},
      "measure": {"value": "<measurement type or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "effect_size": {"value": "<effect estimate or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "effect_measure": {"value": "<OR|RR|HR|MD|SMD|etc or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "ci_lower": {"value": "<lower CI or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "ci_upper": {"value": "<upper CI or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "p_value": {"value": "<p-value or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "sample_size_intervention": {"value": "<N or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "sample_size_control": {"value": "<N or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "events_intervention": {"value": "<events or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
      "events_control": {"value": "<events or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]}
    }
  ],
  "setting": {
    "description": {"value": "<study setting or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]}
  },
  "follow_up": {
    "duration": {"value": "<follow-up duration or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]}
  },
  "funding": {
    "source": {"value": "<funding source or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]},
    "conflicts": {"value": "<conflicts of interest or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]}
  },
  "limitations": {
    "description": {"value": "<study limitations or null>", "confidence": "<high|medium|low>", \
"missing_reason": "<category or null>", "quotes": ["<quote>"]}
  },
  "conclusions": {
    "description": {"value": "<author conclusions>", "confidence": "<high|medium|low>", "quotes": ["<quote>"]}
  }
}
"""

EXTRACTION_USER_PROMPT = """Extract all study data from the scientific article provided above. \
Follow the JSON output format specified in your instructions exactly. \
Include verbatim quotes from the article for every extracted field. \
Rate your confidence for each field and categorize any missing data."""

TEMPLATE_EXTRACTION_SYSTEM_PROMPT = """You are a systematic review data extraction specialist. \
Extract data from the scientific article according to the extraction template schema provided below.

CRITICAL RULES:
1. Extract ONLY the fields specified in the template schema.
2. For EVERY extracted value, provide the exact verbatim quote from the article.
3. Rate your confidence for each field: "high", "medium", or "low".
4. If information is not found, set value to null and provide a missing_reason:
   - "not_reported": Not mentioned in the article at all
   - "explicitly_absent": Article states this was not measured/collected
   - "not_applicable": Irrelevant for this study design
   - "unclear": Ambiguous text, insufficient to determine value
5. Follow the template's section structure exactly.

EXTRACTION TEMPLATE SCHEMA:
{template_schema}

OUTPUT FORMAT:
Respond with valid JSON where each section from the template is a key, and each field within \
the section maps to an object with "value", "confidence", "missing_reason", and "quotes" keys:
{{
  "<section_name>": {{
    "<field_name>": {{
      "value": "<extracted value or null>",
      "confidence": "<high|medium|low or null>",
      "missing_reason": "<not_reported|explicitly_absent|not_applicable|unclear or null>",
      "quotes": ["<verbatim supporting quote>"]
    }}
  }}
}}
"""

TEMPLATE_EXTRACTION_USER_PROMPT = """Extract data from the article above following the \
extraction template schema in your instructions. Only extract the fields specified in the template. \
Rate your confidence for each field and categorize any missing data."""

VERIFICATION_PASS_SYSTEM_PROMPT = """You are a systematic review data extraction specialist performing \
a verification pass. You have already performed an initial extraction and now need to verify and improve it.

Your tasks:
1. REVIEW fields marked with low confidence — re-examine the article for better evidence.
2. REVIEW fields with missing_reason "unclear" — look more carefully for the information.
3. CHECK supplementary materials, appendices, tables, and figures that may have been missed.
4. CROSS-CHECK numerical values against tables and figures in the article.
5. For each field you improve, explain what additional evidence you found.

Only return fields that you are UPDATING — do not repeat fields that remain unchanged.
Use the same output format as the initial extraction (value, confidence, missing_reason, quotes).
If you cannot improve a field, do not include it in your response."""

VERIFICATION_PASS_USER_PROMPT = """Here is the initial extraction from this article:

{initial_extraction}

The following fields need verification:
{fields_to_verify}

Re-examine the article and return ONLY the fields you can improve, using the same JSON format. \
Focus on low-confidence fields, unclear fields, and any numerical values that should be cross-checked \
against tables or figures."""


def build_few_shot_prompt(examples: list[dict]) -> str:
    """Format training examples as few-shot context for the extraction prompt."""
    if not examples:
        return ""

    import json

    parts = ["<examples>"]
    for i, example in enumerate(examples):
        parts.append(f"<example index='{i + 1}'>")
        parts.append("<article_excerpt>")
        parts.append(example.get("input_text", "")[:3000])
        parts.append("</article_excerpt>")
        parts.append("<correct_extraction>")
        output = example.get("expected_output", {})
        parts.append(json.dumps(output, indent=2))
        parts.append("</correct_extraction>")
        parts.append("</example>")
    parts.append("</examples>")
    parts.append("")
    parts.append(
        "Now extract data from the following article, "
        "using the same format with confidence ratings and missing_reason fields:"
    )

    return "\n".join(parts)
