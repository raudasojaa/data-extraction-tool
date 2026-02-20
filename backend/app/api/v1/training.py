import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.database import get_db
from app.models.training_example import TrainingExample
from app.models.user import User
from app.schemas.training import (
    TrainingExampleCreate,
    TrainingExampleResponse,
    TrainingStatsResponse,
)
from app.services.training_service import get_training_stats, import_word_doc_as_training

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/examples", response_model=list[TrainingExampleResponse])
async def list_training_examples(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TrainingExample)
        .order_by(TrainingExample.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.post(
    "/examples",
    response_model=TrainingExampleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_training_example(
    data: TrainingExampleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    example = TrainingExample(
        source_type="manual",
        contributed_by=user.id,
        input_text=data.input_text,
        expected_output=data.expected_output,
        study_type=data.study_type,
        domain=data.domain,
    )
    db.add(example)
    await db.flush()
    return example


@router.post("/import-word-doc", response_model=list[TrainingExampleResponse])
async def import_word_doc(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith((".docx", ".doc")):
        raise HTTPException(status_code=400, detail="Only Word documents are accepted")

    file_bytes = await file.read()
    examples = await import_word_doc_as_training(db, file_bytes, user.id)
    return examples


@router.delete("/examples/{example_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_training_example(
    example_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TrainingExample).where(TrainingExample.id == example_id)
    )
    example = result.scalar_one_or_none()
    if not example:
        raise HTTPException(status_code=404, detail="Training example not found")

    await db.delete(example)
    await db.flush()


@router.get("/stats", response_model=TrainingStatsResponse)
async def training_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stats = await get_training_stats(db)
    return stats
