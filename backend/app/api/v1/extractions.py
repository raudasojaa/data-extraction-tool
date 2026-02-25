import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.deps import get_current_user
from app.database import get_db
from app.models.correction import Correction
from app.models.extraction import Extraction
from app.models.pdf_page import PdfPage
from app.models.user import User
from app.schemas.extraction import (
    CorrectionCreate,
    CorrectionResponse,
    ExtractionResponse,
    ExtractionTrigger,
    ExtractionUpdate,
    ReviewProgressResponse,
    ReviewStatusUpdate,
)
from app.services.extraction_service import run_extraction
from app.services.synthesis_service import generate_synthesis
from app.services.training_service import create_training_example_from_correction

router = APIRouter(tags=["extractions"])


@router.post(
    "/articles/{article_id}/extract",
    response_model=ExtractionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_extraction(
    article_id: uuid.UUID,
    data: ExtractionTrigger | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trigger data extraction for an article."""
    template_id = data.extraction_template_id if data else None
    try:
        extraction = await run_extraction(db, article_id, user.id, template_id)
        return extraction
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/extractions/{extraction_id}", response_model=ExtractionResponse)
async def get_extraction(
    extraction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Extraction).where(Extraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    return extraction


@router.get(
    "/articles/{article_id}/extractions",
    response_model=list[ExtractionResponse],
)
async def list_extractions(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Extraction)
        .where(Extraction.article_id == article_id)
        .order_by(Extraction.version.desc())
    )
    return list(result.scalars().all())


@router.put("/extractions/{extraction_id}", response_model=ExtractionResponse)
async def update_extraction(
    extraction_id: uuid.UUID,
    data: ExtractionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Extraction).where(Extraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(extraction, field, value)

    await db.flush()
    return extraction


@router.post(
    "/extractions/{extraction_id}/corrections",
    response_model=CorrectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_correction(
    extraction_id: uuid.UUID,
    data: CorrectionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Submit a correction to an extracted field."""
    ext_result = await db.execute(
        select(Extraction).where(Extraction.id == extraction_id)
    )
    extraction = ext_result.scalar_one_or_none()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    correction = Correction(
        extraction_id=extraction_id,
        user_id=user.id,
        field_path=data.field_path,
        original_value=data.original_value,
        corrected_value=data.corrected_value,
        correction_type=data.correction_type,
        rationale=data.rationale,
    )
    db.add(correction)
    await db.flush()

    # Generate training example from correction if user is a contributor
    extraction_dict = {
        "study_design": extraction.study_design,
        "population": extraction.population,
        "intervention": extraction.intervention,
        "comparator": extraction.comparator,
        "outcomes": extraction.outcomes,
    }

    # Get article text for the training example
    pages_result = await db.execute(
        select(PdfPage).where(PdfPage.article_id == extraction.article_id)
        .order_by(PdfPage.page_number)
    )
    pages = list(pages_result.scalars().all())
    article_text = "\n".join(p.text_content or "" for p in pages)

    training_example = await create_training_example_from_correction(
        db, correction, extraction_dict, article_text
    )

    if training_example:
        correction.applied_to_training = True
        await db.flush()

    return correction


@router.get(
    "/extractions/{extraction_id}/corrections",
    response_model=list[CorrectionResponse],
)
async def list_corrections(
    extraction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Correction)
        .where(Correction.extraction_id == extraction_id)
        .order_by(Correction.created_at.desc())
    )
    return list(result.scalars().all())


@router.put(
    "/extractions/{extraction_id}/review-status",
    response_model=ExtractionResponse,
)
async def update_review_status(
    extraction_id: uuid.UUID,
    data: ReviewStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update the review status for a specific field."""
    result = await db.execute(
        select(Extraction).where(Extraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    if data.status not in ("verified", "needs_review", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")

    review = extraction.field_review_status or {}
    review[data.field_path] = {
        "status": data.status,
        "reviewed_by": str(user.id),
        "reviewed_at": str(db.info.get("now", "")),
    }
    extraction.field_review_status = review
    await db.flush()
    return extraction


@router.get(
    "/extractions/{extraction_id}/review-progress",
    response_model=ReviewProgressResponse,
)
async def get_review_progress(
    extraction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get review progress counts for an extraction."""
    result = await db.execute(
        select(Extraction).where(Extraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")

    review = extraction.field_review_status or {}
    counts = {"verified": 0, "needs_review": 0, "pending": 0}
    for field_data in review.values():
        s = field_data.get("status", "pending") if isinstance(field_data, dict) else "pending"
        if s in counts:
            counts[s] += 1

    return ReviewProgressResponse(
        total_fields=len(review),
        **counts,
    )


@router.post(
    "/extractions/{extraction_id}/synthesize",
    response_model=ExtractionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_synthesis(
    extraction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate evidence synthesis for an extraction."""
    try:
        await generate_synthesis(db, extraction_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    result = await db.execute(
        select(Extraction).where(Extraction.id == extraction_id)
    )
    return result.scalar_one()
