import uuid
from datetime import datetime

from pydantic import BaseModel


class TrainingExampleResponse(BaseModel):
    id: uuid.UUID
    source_type: str
    input_text: str
    expected_output: dict
    study_type: str | None
    domain: str | None
    quality_score: float
    usage_count: int
    is_active: bool
    contributed_by: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TrainingExampleCreate(BaseModel):
    input_text: str
    expected_output: dict
    study_type: str | None = None
    domain: str | None = None


class TrainingStatsResponse(BaseModel):
    total_examples: int
    active_examples: int
    by_source_type: dict
    by_study_type: dict
    avg_quality_score: float


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    extraction_template_id: uuid.UUID | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_by: uuid.UUID
    extraction_template_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    extraction_template_id: uuid.UUID | None = None


class MethodologyReferenceResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    category: str
    is_active: bool
    uploaded_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class MethodologyReferenceUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    is_active: bool | None = None


class ExtractionTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    parsed_schema: dict | None
    is_default: bool
    uploaded_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class ExtractionTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_default: bool | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    task_type: str
    status: str
    progress: float
    result: dict | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
