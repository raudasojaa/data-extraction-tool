import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_admin_user, get_current_user
from app.config import settings
from app.database import get_db
from app.models.methodology_reference import MethodologyReference
from app.models.user import User
from app.schemas.training import MethodologyReferenceResponse, MethodologyReferenceUpdate
from app.services.methodology_service import upload_methodology_reference

router = APIRouter(prefix="/methodology", tags=["methodology"])


@router.get("/references", response_model=list[MethodologyReferenceResponse])
async def list_references(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(MethodologyReference).order_by(MethodologyReference.created_at.desc())
    if category:
        query = query.where(MethodologyReference.category == category)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/references",
    response_model=MethodologyReferenceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_reference(
    file: UploadFile,
    title: str = Form(...),
    category: str = Form(...),
    description: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_admin_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    file_bytes = await file.read()
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.max_upload_size_mb}MB",
        )
    ref = await upload_methodology_reference(
        db, file_bytes, file.filename, title, category, user.id, description
    )
    return ref


@router.put("/references/{ref_id}", response_model=MethodologyReferenceResponse)
async def update_reference(
    ref_id: uuid.UUID,
    data: MethodologyReferenceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(MethodologyReference).where(MethodologyReference.id == ref_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ref, field, value)

    await db.flush()
    return ref


@router.delete("/references/{ref_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reference(
    ref_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(MethodologyReference).where(MethodologyReference.id == ref_id)
    )
    ref = result.scalar_one_or_none()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")

    await db.delete(ref)
    await db.flush()
