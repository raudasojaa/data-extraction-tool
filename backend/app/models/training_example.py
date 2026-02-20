import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TrainingExample(Base):
    __tablename__ = "training_examples"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    contributed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    expected_output: Mapped[dict] = mapped_column(JSONB, nullable=False)

    study_type: Mapped[str | None] = mapped_column(String(100))
    domain: Mapped[str | None] = mapped_column(String(100))
    complexity: Mapped[str | None] = mapped_column(String(50))

    # Embedding stored as JSON array (pgvector column added via migration when extension is available)
    embedding: Mapped[dict | None] = mapped_column(JSONB)

    quality_score: Mapped[float] = mapped_column(Float, default=1.0)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
