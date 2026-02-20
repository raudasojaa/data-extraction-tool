import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.deps import get_current_user
from app.database import get_db
from app.models.article import Article
from app.models.extraction import Extraction
from app.models.project import Project
from app.models.user import User
from app.schemas.article import ArticleResponse
from app.schemas.training import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.extraction_service import run_extraction

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project).order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(
        name=data.name,
        description=data.description,
        created_by=user.id,
        extraction_template_id=data.extraction_template_id,
    )
    db.add(project)
    await db.flush()
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.flush()
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.flush()


@router.get("/{project_id}/articles", response_model=list[ArticleResponse])
async def list_project_articles(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Article)
        .where(Article.project_id == project_id)
        .order_by(Article.created_at)
    )
    return list(result.scalars().all())


@router.post("/{project_id}/extract-all", status_code=status.HTTP_202_ACCEPTED)
async def batch_extract_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trigger extraction for all articles in a project."""
    project_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    articles_result = await db.execute(
        select(Article).where(Article.project_id == project_id)
    )
    articles = list(articles_result.scalars().all())

    results = []
    for article in articles:
        # Check if already extracted
        ext_result = await db.execute(
            select(Extraction)
            .where(Extraction.article_id == article.id)
            .order_by(Extraction.version.desc())
            .limit(1)
        )
        existing = ext_result.scalar_one_or_none()
        if existing and existing.status == "completed":
            results.append({"article_id": str(article.id), "status": "already_extracted"})
            continue

        try:
            extraction = await run_extraction(
                db, article.id, user.id, project.extraction_template_id
            )
            results.append({
                "article_id": str(article.id),
                "extraction_id": str(extraction.id),
                "status": "completed",
            })
        except Exception as e:
            results.append({
                "article_id": str(article.id),
                "status": "failed",
                "error": str(e),
            })

    return {"project_id": str(project_id), "results": results}
