import base64
import uuid

import pymupdf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.methodology_reference import MethodologyReference


async def upload_methodology_reference(
    db: AsyncSession,
    file_bytes: bytes,
    filename: str,
    title: str,
    category: str,
    user_id: uuid.UUID,
    description: str | None = None,
) -> MethodologyReference:
    file_id = str(uuid.uuid4())
    file_path = settings.upload_path / f"methodology/{file_id}.pdf"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(file_bytes)

    ref = MethodologyReference(
        uploaded_by=user_id,
        title=title,
        description=description,
        file_path=str(file_path),
        category=category,
    )
    db.add(ref)
    await db.flush()
    return ref


async def get_active_references(
    db: AsyncSession, category: str | None = None
) -> list[MethodologyReference]:
    query = select(MethodologyReference).where(MethodologyReference.is_active.is_(True))
    if category:
        query = query.where(MethodologyReference.category == category)
    result = await db.execute(query)
    return list(result.scalars().all())


def load_reference_as_base64(file_path: str) -> str:
    """Load a PDF file and return base64-encoded content for Claude API."""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def extract_reference_text(file_path: str, max_pages: int = 20) -> str:
    """Extract text from a methodology PDF for context."""
    doc = pymupdf.open(file_path)
    text_parts = []
    for page_num in range(min(len(doc), max_pages)):
        page = doc[page_num]
        text_parts.append(page.get_text("text", sort=True))
    doc.close()
    return "\n\n".join(text_parts)
