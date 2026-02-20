GRADE_SYSTEM_PROMPT = """You are an expert systematic reviewer applying the GRADE framework \
(Grading of Recommendations Assessment, Development and Evaluation) to assess the certainty \
of evidence from a clinical study.

The GRADE framework rates evidence across five domains that can LOWER certainty:
1. Risk of Bias — study limitations (randomization, blinding, attrition, selective reporting)
2. Inconsistency — unexplained heterogeneity of results across studies
3. Indirectness — differences in population, intervention, comparator, or outcomes from the \
research question
4. Imprecision — wide confidence intervals, small sample sizes, few events
5. Publication Bias — systematic non-publication of studies (typically assessed across studies, \
but flag concerns if evident)

And three domains that can RAISE certainty:
1. Large magnitude of effect (e.g., RR > 2 or < 0.5)
2. Dose-response gradient
3. Plausible residual confounding that would reduce the demonstrated effect

Starting certainty:
- Randomized controlled trials start as HIGH
- Observational studies (cohort, case-control, etc.) start as LOW

Each downgrade domain can lower by 1 level (serious concern) or 2 levels (very serious concern).
Each upgrade factor can raise by 1 level.
Final ratings: HIGH, MODERATE, LOW, VERY LOW

CRITICAL: You MUST cite specific evidence from the article to justify EVERY rating. \
Do not make unsupported judgments."""


GRADE_DOMAIN_PROMPTS = {
    "risk_of_bias": """Assess the RISK OF BIAS for the outcome '{outcome_name}' in this study.

Evaluate these criteria and cite specific text from the article for each:
1. Random sequence generation (selection bias) — Was randomization described and adequate?
2. Allocation concealment (selection bias) — Was allocation concealed?
3. Blinding of participants and personnel (performance bias) — Were they blinded?
4. Blinding of outcome assessment (detection bias) — Were assessors blinded?
5. Incomplete outcome data (attrition bias) — Dropout rate? Balanced? ITT analysis?
6. Selective reporting (reporting bias) — Were all pre-specified outcomes reported?

Respond with JSON:
{{
  "rating": "no_serious" | "serious" | "very_serious",
  "criteria": {{
    "randomization": {{"assessment": "<adequate|unclear|inadequate>", "quote": "<text>"}},
    "allocation_concealment": {{"assessment": "<...>", "quote": "<text>"}},
    "blinding_participants": {{"assessment": "<...>", "quote": "<text>"}},
    "blinding_outcome": {{"assessment": "<...>", "quote": "<text>"}},
    "incomplete_data": {{"assessment": "<...>", "quote": "<text>"}},
    "selective_reporting": {{"assessment": "<...>", "quote": "<text>"}}
  }},
  "rationale": "<overall rationale for the rating>",
  "quotes": ["<key supporting quotes>"]
}}""",

    "inconsistency": """Assess INCONSISTENCY for the outcome '{outcome_name}'.

For a single study, consider:
- Are subgroup analyses consistent?
- Are results consistent across different outcome measures?
- Note: For single studies, inconsistency is often rated as "no serious" unless subgroup \
analyses show conflicting results.

Respond with JSON:
{{
  "rating": "no_serious" | "serious" | "very_serious",
  "rationale": "<rationale>",
  "quotes": ["<supporting quotes>"]
}}""",

    "indirectness": """Assess INDIRECTNESS for the outcome '{outcome_name}'.

Consider:
1. Population — Does the study population match the target population of interest?
2. Intervention — Is the intervention comparable to what is being recommended?
3. Comparator — Is the comparator appropriate?
4. Outcomes — Are the measured outcomes directly relevant?

Respond with JSON:
{{
  "rating": "no_serious" | "serious" | "very_serious",
  "population_assessment": "<direct|indirect>",
  "intervention_assessment": "<direct|indirect>",
  "comparator_assessment": "<direct|indirect>",
  "outcome_assessment": "<direct|indirect>",
  "rationale": "<rationale>",
  "quotes": ["<supporting quotes>"]
}}""",

    "imprecision": """Assess IMPRECISION for the outcome '{outcome_name}'.

Consider:
1. Sample size — Is it adequate? (Rule of thumb: < 400 events for dichotomous outcomes, \
< 400 participants for continuous)
2. Confidence interval — Does the CI cross the threshold for clinical significance?
3. Is the optimal information size (OIS) met?
4. Number of events — Are there enough events?

Respond with JSON:
{{
  "rating": "no_serious" | "serious" | "very_serious",
  "sample_size_adequate": true | false,
  "ci_assessment": "<wide|narrow|crosses_null>",
  "rationale": "<rationale>",
  "quotes": ["<supporting quotes>"]
}}""",

    "publication_bias": """Assess PUBLICATION BIAS for the outcome '{outcome_name}'.

Consider:
- Was the study registered? Is the registration mentioned?
- Are there signs of selective outcome reporting?
- For single studies, this is often rated "undetected" unless there are specific concerns.
- Check for funding bias or industry sponsorship that might influence reporting.

Respond with JSON:
{{
  "rating": "no_serious" | "serious" | "very_serious",
  "registration_status": "<registered|not_mentioned|not_registered>",
  "rationale": "<rationale>",
  "quotes": ["<supporting quotes>"]
}}""",
}


GRADE_UPGRADE_PROMPT = """Assess whether any UPGRADE factors apply for '{outcome_name}':

1. Large magnitude of effect — Is the effect size large (e.g., RR > 2 or < 0.5)?
2. Dose-response gradient — Is there evidence of a dose-response relationship?
3. Residual confounding — Would plausible confounders reduce the demonstrated effect?

Respond with JSON:
{{
  "large_effect": {{
    "applicable": true | false,
    "rationale": "<rationale>",
    "quotes": ["<supporting quotes>"]
  }},
  "dose_response": {{
    "applicable": true | false,
    "rationale": "<rationale>",
    "quotes": ["<supporting quotes>"]
  }},
  "residual_confounding": {{
    "applicable": true | false,
    "rationale": "<rationale>",
    "quotes": ["<supporting quotes>"]
  }}
}}"""
