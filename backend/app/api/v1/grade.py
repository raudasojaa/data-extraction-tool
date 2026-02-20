import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.database import get_db
from app.models.grade_assessment import GradeAssessment
from app.models.user import User
from app.schemas.grade_assessment import GradeAssessmentResponse, GradeOverride
from app.services.grade_service import compute_overall_certainty, run_grade_assessment

router = APIRouter(tags=["grade"])


@router.post(
    "/extractions/{extraction_id}/grade",
    response_model=list[GradeAssessmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def trigger_grade_assessment(
    extraction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trigger GRADE assessment for all outcomes in an extraction."""
    try:
        assessments = await run_grade_assessment(db, extraction_id)
        return assessments
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/extractions/{extraction_id}/grade",
    response_model=list[GradeAssessmentResponse],
)
async def get_grade_assessments(
    extraction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(GradeAssessment)
        .where(GradeAssessment.extraction_id == extraction_id)
        .order_by(GradeAssessment.outcome_name)
    )
    return list(result.scalars().all())


@router.put(
    "/grade-assessments/{assessment_id}",
    response_model=GradeAssessmentResponse,
)
async def override_grade_domain(
    assessment_id: uuid.UUID,
    data: GradeOverride,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Override a specific GRADE domain rating."""
    result = await db.execute(
        select(GradeAssessment).where(GradeAssessment.id == assessment_id)
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Apply the override to the specific domain
    valid_domains = [
        "risk_of_bias",
        "inconsistency",
        "indirectness",
        "imprecision",
        "publication_bias",
    ]

    if data.domain not in valid_domains:
        raise HTTPException(status_code=400, detail=f"Invalid domain. Must be one of: {valid_domains}")

    domain_data = getattr(assessment, data.domain) or {}
    domain_data["rating"] = data.new_rating
    domain_data["override_reason"] = data.reason
    domain_data["overridden"] = True
    setattr(assessment, data.domain, domain_data)

    assessment.is_overridden = True
    assessment.overridden_by = user.id
    assessment.override_reason = data.reason

    # Recompute overall certainty with updated domain ratings
    domain_ratings = {
        "risk_of_bias": assessment.risk_of_bias or {},
        "inconsistency": assessment.inconsistency or {},
        "indirectness": assessment.indirectness or {},
        "imprecision": assessment.imprecision or {},
        "publication_bias": assessment.publication_bias or {},
    }
    upgrade_factors = {
        "large_effect": assessment.large_effect or {},
        "dose_response": assessment.dose_response or {},
        "residual_confounding": assessment.residual_confounding or {},
    }

    # Need study design from extraction
    from app.models.extraction import Extraction

    ext_result = await db.execute(
        select(Extraction).where(Extraction.id == assessment.extraction_id)
    )
    extraction = ext_result.scalar_one()
    study_type = ""
    if extraction.study_design and isinstance(extraction.study_design, dict):
        study_type = extraction.study_design.get("type", "")

    assessment.overall_certainty = compute_overall_certainty(
        study_type, domain_ratings, upgrade_factors
    )

    await db.flush()
    return assessment
