import uuid
from datetime import datetime

from pydantic import BaseModel


class GradeAssessmentResponse(BaseModel):
    id: uuid.UUID
    extraction_id: uuid.UUID
    outcome_name: str
    risk_of_bias: dict | None
    inconsistency: dict | None
    indirectness: dict | None
    imprecision: dict | None
    publication_bias: dict | None
    large_effect: dict | None
    dose_response: dict | None
    residual_confounding: dict | None
    overall_certainty: str | None
    overall_rationale: str | None
    is_overridden: bool
    overridden_by: uuid.UUID | None
    override_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GradeOverride(BaseModel):
    domain: str
    new_rating: str
    reason: str


class GradeTrigger(BaseModel):
    pass
