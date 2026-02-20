import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Correction(Base):
    __tablename__ = "corrections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    extraction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("extractions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    field_path: Mapped[str] = mapped_column(String(255), nullable=False)
    original_value: Mapped[dict | None] = mapped_column(JSONB)
    corrected_value: Mapped[dict | None] = mapped_column(JSONB)
    correction_type: Mapped[str | None] = mapped_column(String(50))
    rationale: Mapped[str | None] = mapped_column(Text)
    applied_to_training: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    extraction = relationship("Extraction", back_populates="corrections")
    user = relationship("User", back_populates="corrections")
