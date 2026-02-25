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
    VERIFICATION_PASS_SYSTEM_PROMPT,
    VERIFICATION_PASS_USER_PROMPT,
    build_few_shot_prompt,
)
from app.models.article import Article
from app.models.extraction import Extraction
from app.models.extraction_template import ExtractionTemplate
from app.models.pdf_page import PdfPage
from app.services.methodology_service import get_active_references
from app.services.pdf_service import find_quote_locations

logger = logging.getLogger(__name__)

VALID_CONFIDENCE = {"high", "medium", "low"}
VALID_MISSING_REASONS = {"not_reported", "explicitly_absent", "not_applicable", "unclear"}


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

    # Pass 1: Initial extraction
    response = claude_client.extract_from_pdf(
        pdf_path=article.file_path,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        methodology_pdfs=methodology_paths if methodology_paths else None,
        few_shot_examples=few_shot_prompt if few_shot_prompt else None,
    )

    # Parse the JSON response
    extraction_data = _parse_extraction_response(response["text"])

    # Normalize confidence metadata
    _normalize_confidence_metadata(extraction_data)

    # Compute completeness before two-pass check
    completeness = _compute_completeness(extraction_data)

    # Pass 2: Verification pass if quality is low
    total = completeness.get("total_fields", 0)
    low_conf = completeness.get("low_confidence", 0)
    missing = completeness.get("missing", 0)
    needs_verify = (low_conf + missing) / max(total, 1) > 0.2

    total_prompt_tokens = response.get("prompt_tokens", 0) or 0
    total_completion_tokens = response.get("completion_tokens", 0) or 0

    if needs_verify:
        fields_to_verify = _collect_fields_needing_verification(extraction_data)
        if fields_to_verify:
            try:
                verify_response = claude_client.extract_from_pdf(
                    pdf_path=article.file_path,
                    system_prompt=VERIFICATION_PASS_SYSTEM_PROMPT,
                    user_prompt=VERIFICATION_PASS_USER_PROMPT.format(
                        initial_extraction=json.dumps(extraction_data, indent=2),
                        fields_to_verify="\n".join(f"- {f}" for f in fields_to_verify),
                    ),
                    methodology_pdfs=methodology_paths if methodology_paths else None,
                )
                verify_data = _parse_extraction_response(verify_response["text"])
                extraction_data = _merge_verification_pass(extraction_data, verify_data)
                _normalize_confidence_metadata(extraction_data)
                completeness = _compute_completeness(extraction_data)
                total_prompt_tokens += verify_response.get("prompt_tokens", 0) or 0
                total_completion_tokens += verify_response.get("completion_tokens", 0) or 0
            except Exception:
                logger.warning("Verification pass failed, using initial extraction", exc_info=True)

    # Map quotes to PDF coordinates
    extraction_data = _map_source_locations(article.file_path, extraction_data)

    # Run numerical validation
    from app.services.validation_service import validate_extraction
    validation_warnings = validate_extraction(extraction_data)

    # Auto-generate initial review status based on confidence
    review_status = _generate_initial_review_status(extraction_data)

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
        completeness_summary=completeness,
        validation_warnings=validation_warnings if validation_warnings else None,
        field_review_status=review_status,
        raw_llm_response={"text": response["text"]},
        prompt_tokens=total_prompt_tokens,
        completion_tokens=total_completion_tokens,
        model_used=response.get("model"),
    )
    db.add(extraction)

    # Update article status
    article.status = "extracted"
    await db.flush()

    return extraction


def _parse_extraction_response(text: str) -> dict:
    """Parse the JSON extraction response from Claude."""
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


def _normalize_confidence_metadata(data: dict) -> None:
    """Ensure all fields have valid confidence and missing_reason values."""
    for key, value in data.items():
        if isinstance(value, dict):
            # Check if this is a field-level dict with "value" key (new format)
            if "value" in value and ("confidence" in value or "quotes" in value):
                _normalize_field(value)
            else:
                # Section-level dict — recurse into sub-fields
                for sub_key, sub_val in value.items():
                    if isinstance(sub_val, dict) and "value" in sub_val:
                        _normalize_field(sub_val)
                    elif isinstance(sub_val, dict):
                        _normalize_confidence_metadata(sub_val)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    _normalize_confidence_metadata(item)


def _normalize_field(field: dict) -> None:
    """Normalize a single extraction field's confidence metadata."""
    conf = field.get("confidence")
    if conf not in VALID_CONFIDENCE:
        # If there's a value, default to low; if no value, set to None
        field["confidence"] = "low" if field.get("value") is not None else None

    reason = field.get("missing_reason")
    if field.get("value") is None:
        if reason not in VALID_MISSING_REASONS:
            field["missing_reason"] = "not_reported"
    else:
        field["missing_reason"] = None

    if "quotes" not in field:
        field["quotes"] = []


def _compute_completeness(data: dict) -> dict:
    """Compute extraction completeness summary from the structured data."""
    stats = {
        "total_fields": 0,
        "extracted": 0,
        "missing": 0,
        "low_confidence": 0,
        "medium_confidence": 0,
        "high_confidence": 0,
        "by_section": {},
        "missing_reasons": {
            "not_reported": 0,
            "explicitly_absent": 0,
            "not_applicable": 0,
            "unclear": 0,
        },
    }

    for section_key, section_val in data.items():
        if section_key in ("error", "raw_text", "custom_fields"):
            continue

        section_stats = {"total": 0, "extracted": 0, "missing": 0, "low_confidence": 0}

        if isinstance(section_val, dict):
            _count_fields_in_dict(section_val, stats, section_stats)
        elif isinstance(section_val, list):
            for item in section_val:
                if isinstance(item, dict):
                    _count_fields_in_dict(item, stats, section_stats)

        if section_stats["total"] > 0:
            stats["by_section"][section_key] = section_stats

    return stats


def _count_fields_in_dict(d: dict, stats: dict, section_stats: dict) -> None:
    """Count fields in a dict, updating stats."""
    for key, val in d.items():
        if key in ("source_locations", "quotes"):
            continue
        if isinstance(val, dict) and "value" in val:
            stats["total_fields"] += 1
            section_stats["total"] += 1
            if val.get("value") is not None:
                stats["extracted"] += 1
                section_stats["extracted"] += 1
                conf = val.get("confidence", "low")
                if conf == "high":
                    stats["high_confidence"] += 1
                elif conf == "medium":
                    stats["medium_confidence"] += 1
                else:
                    stats["low_confidence"] += 1
                    section_stats["low_confidence"] += 1
            else:
                stats["missing"] += 1
                section_stats["missing"] += 1
                reason = val.get("missing_reason", "not_reported")
                if reason in stats["missing_reasons"]:
                    stats["missing_reasons"][reason] += 1
        elif isinstance(val, dict):
            _count_fields_in_dict(val, stats, section_stats)
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    _count_fields_in_dict(item, stats, section_stats)


def _collect_fields_needing_verification(data: dict, prefix: str = "") -> list[str]:
    """Collect field paths that need verification (low confidence or unclear)."""
    fields = []
    for key, val in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(val, dict):
            if "value" in val:
                conf = val.get("confidence")
                reason = val.get("missing_reason")
                if conf == "low" or reason == "unclear":
                    fields.append(path)
            else:
                fields.extend(_collect_fields_needing_verification(val, path))
        elif isinstance(val, list):
            for i, item in enumerate(val):
                if isinstance(item, dict):
                    fields.extend(
                        _collect_fields_needing_verification(item, f"{path}[{i}]")
                    )
    return fields


def _merge_verification_pass(original: dict, verification: dict) -> dict:
    """Merge verification pass results into the original extraction."""
    for key, val in verification.items():
        if key not in original:
            continue
        if isinstance(val, dict):
            if isinstance(original[key], dict):
                if "value" in val and "value" in original.get(key, {}):
                    # Direct field — replace if verification improved it
                    v_conf = val.get("confidence", "low")
                    o_conf = original[key].get("confidence", "low")
                    conf_order = {"high": 3, "medium": 2, "low": 1}
                    if (
                        conf_order.get(v_conf, 0) > conf_order.get(o_conf, 0)
                        or (original[key].get("value") is None and val.get("value") is not None)
                    ):
                        original[key] = val
                else:
                    # Section dict — recurse
                    _merge_verification_pass(original[key], val)
        elif isinstance(val, list) and isinstance(original.get(key), list):
            # For lists (outcomes), merge by index
            for i, item in enumerate(val):
                if i < len(original[key]) and isinstance(item, dict):
                    _merge_verification_pass(original[key][i], item)
    return original


def _generate_initial_review_status(data: dict) -> dict:
    """Generate initial field review status based on confidence levels."""
    status = {}
    _walk_fields_for_review(data, "", status)
    return status


def _walk_fields_for_review(data: dict, prefix: str, status: dict) -> None:
    """Recursively walk fields and set initial review status."""
    for key, val in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(val, dict):
            if "value" in val:
                conf = val.get("confidence")
                if conf == "low" or val.get("missing_reason") == "unclear":
                    status[path] = {"status": "needs_review"}
                else:
                    status[path] = {"status": "pending"}
            else:
                _walk_fields_for_review(val, path, status)
        elif isinstance(val, list):
            for i, item in enumerate(val):
                if isinstance(item, dict):
                    _walk_fields_for_review(item, f"{path}[{i}]", status)


def _map_source_locations(pdf_path: str, data: dict) -> dict:
    """Map verbatim quotes in extraction data to PDF coordinates."""
    for key, value in data.items():
        if isinstance(value, dict):
            # Collect all quotes from sub-fields in the new format
            all_quotes = []
            for sub_key, sub_val in value.items():
                if isinstance(sub_val, dict) and "quotes" in sub_val:
                    all_quotes.extend(sub_val.get("quotes", []))
            # Also check for top-level quotes in old format
            if "quotes" in value:
                all_quotes.extend(value.get("quotes", []))

            if all_quotes:
                locations = []
                for quote in all_quotes:
                    if isinstance(quote, str) and quote:
                        locs = find_quote_locations(pdf_path, quote)
                        locations.extend(locs)
                value["source_locations"] = locations

        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    all_quotes = []
                    for sub_key, sub_val in item.items():
                        if isinstance(sub_val, dict) and "quotes" in sub_val:
                            all_quotes.extend(sub_val.get("quotes", []))
                    if "quotes" in item:
                        all_quotes.extend(item.get("quotes", []))

                    if all_quotes:
                        locations = []
                        for quote in all_quotes:
                            if isinstance(quote, str) and quote:
                                locs = find_quote_locations(pdf_path, quote)
                                locations.extend(locs)
                        item["source_locations"] = locations

    return data
