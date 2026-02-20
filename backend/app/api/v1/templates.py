import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.database import get_db
from app.models.extraction_template import ExtractionTemplate
from app.models.user import User
from app.schemas.training import ExtractionTemplateResponse, ExtractionTemplateUpdate
from app.services.template_service import upload_template

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=list[ExtractionTemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExtractionTemplate).order_by(ExtractionTemplate.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/",
    response_model=ExtractionTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_extraction_template(
    file: UploadFile,
    name: str,
    description: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith((".docx", ".doc")):
        raise HTTPException(status_code=400, detail="Only Word documents are accepted")

    file_bytes = await file.read()
    template = await upload_template(db, file_bytes, file.filename, name, user.id, description)
    return template


@router.get("/{template_id}", response_model=ExtractionTemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExtractionTemplate).where(ExtractionTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=ExtractionTemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    data: ExtractionTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExtractionTemplate).where(ExtractionTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # When setting a template as default, clear is_default on all others first
    if data.is_default:
        others_result = await db.execute(
            select(ExtractionTemplate).where(ExtractionTemplate.id != template_id)
        )
        for other in others_result.scalars().all():
            other.is_default = False

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)

    await db.flush()
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExtractionTemplate).where(ExtractionTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(template)
    await db.flush()
