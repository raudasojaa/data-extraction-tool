import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import claude_client
from app.ai.prompts.grade import (
    GRADE_DOMAIN_PROMPTS,
    GRADE_SYSTEM_PROMPT,
    GRADE_UPGRADE_PROMPT,
)
from app.models.article import Article
from app.models.extraction import Extraction
from app.models.grade_assessment import GradeAssessment
from app.services.methodology_service import get_active_references
from app.services.pdf_service import find_quote_locations

logger = logging.getLogger(__name__)


async def run_grade_assessment(
    db: AsyncSession,
    extraction_id: uuid.UUID,
) -> list[GradeAssessment]:
    """Run GRADE assessment for all outcomes in an extraction."""
    ext_result = await db.execute(
        select(Extraction).where(Extraction.id == extraction_id)
    )
    extraction = ext_result.scalar_one_or_none()
    if not extraction:
        raise ValueError("Extraction not found")

    article_result = await db.execute(
        select(Article).where(Article.id == extraction.article_id)
    )
    article = article_result.scalar_one()

    # Get methodology references for GRADE assessment
    methodology_refs = await get_active_references(db, category="grade_handbook")
    methodology_paths = [ref.file_path for ref in methodology_refs]

    # Extract outcome names
    outcomes = extraction.outcomes
    if not outcomes:
        logger.warning(f"No outcomes found in extraction {extraction_id}")
        return []

    if isinstance(outcomes, dict):
        outcomes = [outcomes]

    assessments = []
    for outcome in outcomes:
        outcome_name = outcome.get("name", "Unknown Outcome")
        assessment = await _assess_outcome(
            db, article, extraction, outcome_name, methodology_paths
        )
        assessments.append(assessment)

    await db.flush()
    return assessments


async def _assess_outcome(
    db: AsyncSession,
    article: Article,
    extraction: Extraction,
    outcome_name: str,
    methodology_paths: list[str],
) -> GradeAssessment:
    """Run GRADE assessment for a single outcome."""
    domain_results = {}

    # Assess each of the 5 downgrade domains
    for domain_name, prompt_template in GRADE_DOMAIN_PROMPTS.items():
        user_prompt = prompt_template.format(outcome_name=outcome_name)
        response = claude_client.extract_from_pdf(
            pdf_path=article.file_path,
            system_prompt=GRADE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            methodology_pdfs=methodology_paths if methodology_paths else None,
            max_tokens=4096,
        )
        domain_data = _parse_json_response(response["text"])

        # Map quotes to PDF locations
        quotes = domain_data.get("quotes", [])
        if quotes:
            locations = []
            for quote in quotes:
                locs = find_quote_locations(article.file_path, quote)
                locations.extend(locs)
            domain_data["source_locations"] = locations

        domain_results[domain_name] = domain_data

    # Assess upgrade factors
    upgrade_prompt = GRADE_UPGRADE_PROMPT.format(outcome_name=outcome_name)
    upgrade_response = claude_client.extract_from_pdf(
        pdf_path=article.file_path,
        system_prompt=GRADE_SYSTEM_PROMPT,
        user_prompt=upgrade_prompt,
        methodology_pdfs=methodology_paths if methodology_paths else None,
        max_tokens=4096,
    )
    upgrade_data = _parse_json_response(upgrade_response["text"])

    # Compute overall certainty deterministically
    study_type = ""
    if extraction.study_design and isinstance(extraction.study_design, dict):
        study_type = extraction.study_design.get("type", "")

    overall_certainty = compute_overall_certainty(
        study_design=study_type,
        domain_ratings=domain_results,
        upgrade_factors=upgrade_data,
    )

    # Build rationale
    rationale = _build_overall_rationale(domain_results, upgrade_data, overall_certainty)

    assessment = GradeAssessment(
        extraction_id=extraction.id,
        outcome_name=outcome_name,
        risk_of_bias=domain_results.get("risk_of_bias"),
        inconsistency=domain_results.get("inconsistency"),
        indirectness=domain_results.get("indirectness"),
        imprecision=domain_results.get("imprecision"),
        publication_bias=domain_results.get("publication_bias"),
        large_effect=upgrade_data.get("large_effect"),
        dose_response=upgrade_data.get("dose_response"),
        residual_confounding=upgrade_data.get("residual_confounding"),
        overall_certainty=overall_certainty,
        overall_rationale=rationale,
    )
    db.add(assessment)
    return assessment


def compute_overall_certainty(
    study_design: str,
    domain_ratings: dict,
    upgrade_factors: dict,
) -> str:
    """Compute the overall GRADE certainty rating deterministically."""
    # Starting certainty based on study design
    rct_keywords = ["rct", "randomized", "randomised", "random"]
    if any(kw in study_design.lower() for kw in rct_keywords):
        certainty_level = 4  # HIGH
    else:
        certainty_level = 2  # LOW (observational)

    # Apply downgrades
    downgrade_map = {"no_serious": 0, "serious": -1, "very_serious": -2}
    for domain_name in [
        "risk_of_bias",
        "inconsistency",
        "indirectness",
        "imprecision",
        "publication_bias",
    ]:
        domain = domain_ratings.get(domain_name, {})
        rating = domain.get("rating", "no_serious")
        certainty_level += downgrade_map.get(rating, 0)

    # Apply upgrades
    for factor_name in ["large_effect", "dose_response", "residual_confounding"]:
        factor = upgrade_factors.get(factor_name, {})
        if factor.get("applicable", False):
            certainty_level += 1

    # Clamp to valid range
    certainty_level = max(1, min(4, certainty_level))

    level_map = {4: "high", 3: "moderate", 2: "low", 1: "very_low"}
    return level_map[certainty_level]


def _build_overall_rationale(
    domain_ratings: dict, upgrade_factors: dict, overall: str
) -> str:
    """Build a human-readable rationale for the overall GRADE rating."""
    parts = []

    for domain_name, domain in domain_ratings.items():
        rating = domain.get("rating", "no_serious")
        if rating != "no_serious":
            rationale = domain.get("rationale", "")
            parts.append(
                f"Downgraded for {domain_name.replace('_', ' ')} "
                f"({rating.replace('_', ' ')}): {rationale}"
            )

    for factor_name in ["large_effect", "dose_response", "residual_confounding"]:
        factor = upgrade_factors.get(factor_name, {})
        if factor.get("applicable"):
            rationale = factor.get("rationale", "")
            parts.append(
                f"Upgraded for {factor_name.replace('_', ' ')}: {rationale}"
            )

    if not parts:
        parts.append("No serious concerns across any GRADE domain.")

    return f"Overall certainty: {overall.upper()}. " + " ".join(parts)


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Claude's response."""
    text = text.strip()
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        text = text[start:end].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse GRADE response: {text[:200]}")
        return {"rating": "no_serious", "rationale": "Could not parse AI response"}
