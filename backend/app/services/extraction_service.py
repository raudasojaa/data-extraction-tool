import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.client import claude_client
from app.ai.example_selector import example_selector
from app.ai.prompts.extraction import (
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_USER_PROMPT,
    TEMPLATE_EXTRACTION_SYSTEM_PROMPT,
    TEMPLATE_EXTRACTION_USER_PROMPT,
    build_few_shot_prompt,
)
from app.models.article import Article
from app.models.extraction import Extraction
from app.models.extraction_template import ExtractionTemplate
from app.models.pdf_page import PdfPage
from app.services.methodology_service import get_active_references
from app.services.pdf_service import find_quote_locations

logger = logging.getLogger(__name__)


async def run_extraction(
    db: AsyncSession,
    article_id: uuid.UUID,
    user_id: uuid.UUID,
    template_id: uuid.UUID | None = None,
) -> Extraction:
    """Run the full extraction pipeline for an article."""
    # Load article
    article_result = await db.execute(
        select(Article).where(Article.id == article_id)
    )
    article = article_result.scalar_one_or_none()
    if not article:
        raise ValueError("Article not found")

    # Get article text for example selection
    pages_result = await db.execute(
        select(PdfPage)
        .where(PdfPage.article_id == article_id)
        .order_by(PdfPage.page_number)
    )
    pages = list(pages_result.scalars().all())
    article_text = "\n".join(p.text_content or "" for p in pages)

    # Select few-shot examples from training data
    examples = await example_selector.select_examples(db, article_text)
    few_shot_prompt = build_few_shot_prompt(examples)

    # Get methodology references for extraction
    methodology_refs = await get_active_references(db, category="extraction")
    methodology_paths = [ref.file_path for ref in methodology_refs]

    # Determine prompts based on template
    template = None
    if template_id:
        template_result = await db.execute(
            select(ExtractionTemplate).where(ExtractionTemplate.id == template_id)
        )
        template = template_result.scalar_one_or_none()

    if template and template.parsed_schema:
        system_prompt = TEMPLATE_EXTRACTION_SYSTEM_PROMPT.format(
            template_schema=json.dumps(template.parsed_schema, indent=2)
        )
        user_prompt = TEMPLATE_EXTRACTION_USER_PROMPT
    else:
        system_prompt = EXTRACTION_SYSTEM_PROMPT
        user_prompt = EXTRACTION_USER_PROMPT

    # Call Claude API
    response = claude_client.extract_from_pdf(
        pdf_path=article.file_path,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        methodology_pdfs=methodology_paths if methodology_paths else None,
        few_shot_examples=few_shot_prompt if few_shot_prompt else None,
    )

    # Parse the JSON response
    extraction_data = _parse_extraction_response(response["text"])

    # Map quotes to PDF coordinates
    extraction_data = _map_source_locations(article.file_path, extraction_data)

    # Determine version number
    existing_count_result = await db.execute(
        select(Extraction)
        .where(Extraction.article_id == article_id)
    )
    version = len(list(existing_count_result.scalars().all())) + 1

    # Create extraction record
    extraction = Extraction(
        article_id=article_id,
        extracted_by=user_id,
        extraction_template_id=template_id,
        version=version,
        status="completed",
        study_design=extraction_data.get("study_design"),
        population=extraction_data.get("population"),
        intervention=extraction_data.get("intervention"),
        comparator=extraction_data.get("comparator"),
        outcomes=extraction_data.get("outcomes"),
        setting=extraction_data.get("setting"),
        follow_up=extraction_data.get("follow_up"),
        funding=extraction_data.get("funding"),
        limitations=extraction_data.get("limitations"),
        conclusions=extraction_data.get("conclusions"),
        custom_fields=extraction_data.get("custom_fields"),
        raw_llm_response={"text": response["text"]},
        prompt_tokens=response.get("prompt_tokens"),
        completion_tokens=response.get("completion_tokens"),
        model_used=response.get("model"),
    )
    db.add(extraction)

    # Update article status
    article.status = "extracted"
    await db.flush()

    return extraction


def _parse_extraction_response(text: str) -> dict:
    """Parse the JSON extraction response from Claude."""
    # Try to find JSON in the response
    text = text.strip()

    # Handle markdown code blocks
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
        logger.error(f"Failed to parse extraction response as JSON: {text[:200]}")
        return {"error": "Failed to parse response", "raw_text": text}


def _map_source_locations(pdf_path: str, data: dict) -> dict:
    """Map verbatim quotes in extraction data to PDF coordinates."""
    for key, value in data.items():
        if isinstance(value, dict):
            quotes = value.get("quotes", [])
            if quotes:
                locations = []
                for quote in quotes:
                    locs = find_quote_locations(pdf_path, quote)
                    locations.extend(locs)
                value["source_locations"] = locations

        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    quotes = item.get("quotes", [])
                    if quotes:
                        locations = []
                        for quote in quotes:
                            locs = find_quote_locations(pdf_path, quote)
                            locations.extend(locs)
                        item["source_locations"] = locations

    return data
