import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.export_service import export_extraction_to_word, export_project_to_word

router = APIRouter(prefix="/export", tags=["export"])


@router.post("/extractions/{extraction_id}/word")
async def export_extraction_word(
    extraction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export a single extraction to a Word document."""
    try:
        output_path = await export_extraction_to_word(db, extraction_id)
        return FileResponse(
            str(output_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="extraction_report.docx",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/projects/{project_id}/word")
async def export_project_word(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export all extractions in a project to a single Word document."""
    try:
        output_path = await export_project_to_word(db, project_id)
        return FileResponse(
            str(output_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="project_report.docx",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
