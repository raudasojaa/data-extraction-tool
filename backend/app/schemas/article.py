import uuid
from datetime import datetime

from pydantic import BaseModel


class ArticleResponse(BaseModel):
    id: uuid.UUID
    title: str | None
    authors: str | None
    journal: str | None
    year: int | None
    doi: str | None
    page_count: int | None
    status: str
    project_id: uuid.UUID | None
    uploaded_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ArticleUpdate(BaseModel):
    title: str | None = None
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None
    project_id: uuid.UUID | None = None


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int


class PdfPageResponse(BaseModel):
    page_number: int
    width: float
    height: float
    text_content: str | None
    word_data: dict | None

    model_config = {"from_attributes": True}
