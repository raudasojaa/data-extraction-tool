import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Extraction(Base):
    __tablename__ = "extractions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    extracted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    extraction_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("extraction_templates.id"), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(50), default="pending")

    # Core PICO extraction (structured JSON with source_locations)
    study_design: Mapped[dict | None] = mapped_column(JSONB)
    population: Mapped[dict | None] = mapped_column(JSONB)
    intervention: Mapped[dict | None] = mapped_column(JSONB)
    comparator: Mapped[dict | None] = mapped_column(JSONB)
    outcomes: Mapped[dict | None] = mapped_column(JSONB)

    # Additional extracted data
    setting: Mapped[dict | None] = mapped_column(JSONB)
    follow_up: Mapped[dict | None] = mapped_column(JSONB)
    funding: Mapped[dict | None] = mapped_column(JSONB)
    limitations: Mapped[dict | None] = mapped_column(JSONB)
    conclusions: Mapped[dict | None] = mapped_column(JSONB)

    # Template-driven custom fields
    custom_fields: Mapped[dict | None] = mapped_column(JSONB)

    # Completeness and quality metadata
    completeness_summary: Mapped[dict | None] = mapped_column(JSONB)
    validation_warnings: Mapped[dict | None] = mapped_column(JSONB)
    field_review_status: Mapped[dict | None] = mapped_column(JSONB)
    synthesis: Mapped[dict | None] = mapped_column(JSONB)

    # AI metadata
    raw_llm_response: Mapped[dict | None] = mapped_column(JSONB)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    model_used: Mapped[str | None] = mapped_column(String(100))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    article = relationship("Article", back_populates="extractions")
    template = relationship("ExtractionTemplate")
    grade_assessments = relationship(
        "GradeAssessment", back_populates="extraction", cascade="all, delete-orphan"
    )
    corrections = relationship(
        "Correction", back_populates="extraction", cascade="all, delete-orphan"
    )
