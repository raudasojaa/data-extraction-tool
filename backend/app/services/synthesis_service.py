"""Evidence synthesis generation using Claude."""

import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.client import claude_client
from app.ai.prompts.synthesis import SYNTHESIS_SYSTEM_PROMPT, SYNTHESIS_USER_PROMPT
from app.models.extraction import Extraction
from app.models.grade_assessment import GradeAssessment

logger = logging.getLogger(__name__)


async def generate_synthesis(
    db: AsyncSession,
    extraction_id: uuid.UUID,
) -> dict:
    """Generate an evidence synthesis summary from extraction data and GRADE assessment."""
    result = await db.execute(
        select(Extraction)
        .options(selectinload(Extraction.grade_assessments))
        .where(Extraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    if not extraction:
        raise ValueError("Extraction not found")

    # Build extraction JSON
    extraction_dict = {
        "study_design": extraction.study_design,
        "population": extraction.population,
        "intervention": extraction.intervention,
        "comparator": extraction.comparator,
        "outcomes": extraction.outcomes,
        "setting": extraction.setting,
        "follow_up": extraction.follow_up,
        "funding": extraction.funding,
        "limitations": extraction.limitations,
        "conclusions": extraction.conclusions,
    }

    # Build GRADE JSON
    grade_list = []
    for assessment in extraction.grade_assessments:
        grade_list.append({
            "outcome": assessment.outcome_name,
            "overall_certainty": assessment.overall_certainty,
            "risk_of_bias": assessment.risk_of_bias,
            "inconsistency": assessment.inconsistency,
            "indirectness": assessment.indirectness,
            "imprecision": assessment.imprecision,
            "publication_bias": assessment.publication_bias,
            "rationale": assessment.overall_rationale,
        })

    user_prompt = SYNTHESIS_USER_PROMPT.format(
        extraction_json=json.dumps(extraction_dict, indent=2),
        grade_json=json.dumps(grade_list, indent=2),
    )

    response = claude_client.extract_from_pdf(
        pdf_path="",  # No PDF needed for synthesis
        system_prompt=SYNTHESIS_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        temperature=0.3,
        max_tokens=4096,
    )

    # Parse the synthesis response
    synthesis = _parse_synthesis_response(response["text"])

    # Store on extraction
    extraction.synthesis = synthesis
    await db.flush()

    return synthesis


def _parse_synthesis_response(text: str) -> dict:
    """Parse the synthesis response into structured sections."""
    synthesis = {
        "key_findings": "",
        "certainty_of_evidence": "",
        "strengths": "",
        "limitations": "",
        "clinical_implications": "",
        "raw_text": text,
    }

    # Try to parse section headers from markdown
    current_section = None
    section_map = {
        "key findings": "key_findings",
        "certainty of evidence": "certainty_of_evidence",
        "strengths": "strengths",
        "limitations": "limitations",
        "clinical implications": "clinical_implications",
    }

    lines = text.strip().split("\n")
    buffer = []

    for line in lines:
        stripped = line.strip().lower()
        # Check for markdown headers
        clean = stripped.lstrip("#").strip().rstrip(":").strip("*").strip()
        matched = section_map.get(clean)
        if matched:
            if current_section and buffer:
                synthesis[current_section] = "\n".join(buffer).strip()
            current_section = matched
            buffer = []
        elif current_section:
            buffer.append(line.strip())

    if current_section and buffer:
        synthesis[current_section] = "\n".join(buffer).strip()

    return synthesis
