import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GradeAssessment(Base):
    __tablename__ = "grade_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    extraction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("extractions.id", ondelete="CASCADE"), nullable=False
    )
    outcome_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Five GRADE downgrade domains
    risk_of_bias: Mapped[dict | None] = mapped_column(JSONB)
    inconsistency: Mapped[dict | None] = mapped_column(JSONB)
    indirectness: Mapped[dict | None] = mapped_column(JSONB)
    imprecision: Mapped[dict | None] = mapped_column(JSONB)
    publication_bias: Mapped[dict | None] = mapped_column(JSONB)

    # Three upgrade factors
    large_effect: Mapped[dict | None] = mapped_column(JSONB)
    dose_response: Mapped[dict | None] = mapped_column(JSONB)
    residual_confounding: Mapped[dict | None] = mapped_column(JSONB)

    # Overall
    overall_certainty: Mapped[str | None] = mapped_column(String(20))
    overall_rationale: Mapped[str | None] = mapped_column(Text)

    # Override tracking
    is_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    overridden_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    override_reason: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    extraction = relationship("Extraction", back_populates="grade_assessments")
