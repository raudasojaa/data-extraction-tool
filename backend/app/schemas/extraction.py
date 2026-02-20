import uuid
from datetime import datetime

from pydantic import BaseModel


class SourceLocation(BaseModel):
    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


class ExtractionTrigger(BaseModel):
    extraction_template_id: uuid.UUID | None = None


class ExtractionResponse(BaseModel):
    id: uuid.UUID
    article_id: uuid.UUID
    version: int
    status: str
    study_design: dict | None
    population: dict | None
    intervention: dict | None
    comparator: dict | None
    outcomes: dict | None
    setting: dict | None
    follow_up: dict | None
    funding: dict | None
    limitations: dict | None
    conclusions: dict | None
    custom_fields: dict | None
    extraction_template_id: uuid.UUID | None
    model_used: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExtractionUpdate(BaseModel):
    study_design: dict | None = None
    population: dict | None = None
    intervention: dict | None = None
    comparator: dict | None = None
    outcomes: dict | None = None
    setting: dict | None = None
    follow_up: dict | None = None
    funding: dict | None = None
    limitations: dict | None = None
    conclusions: dict | None = None
    custom_fields: dict | None = None


class CorrectionCreate(BaseModel):
    field_path: str
    original_value: dict | None = None
    corrected_value: dict | None = None
    correction_type: str | None = None
    rationale: str | None = None


class CorrectionResponse(BaseModel):
    id: uuid.UUID
    extraction_id: uuid.UUID
    user_id: uuid.UUID
    field_path: str
    original_value: dict | None
    corrected_value: dict | None
    correction_type: str | None
    rationale: str | None
    applied_to_training: bool
    created_at: datetime

    model_config = {"from_attributes": True}
