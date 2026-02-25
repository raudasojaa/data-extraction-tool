import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.article import Article
from app.models.pdf_page import PdfPage
from app.models.user import User
from app.schemas.article import (
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
    PdfPageResponse,
)
from app.services.pdf_service import upload_and_process_pdf

router = APIRouter(prefix="/articles", tags=["articles"])


@router.post("/", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def upload_article(
    file: UploadFile,
    project_id: uuid.UUID | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
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

    article = await upload_and_process_pdf(
        db, file_bytes, file.filename, user.id, project_id
    )
    return article


@router.get("/", response_model=ArticleListResponse)
async def list_articles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    project_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Article).order_by(Article.created_at.desc())

    if project_id:
        query = query.where(Article.project_id == project_id)
    if status_filter:
        query = query.where(Article.status == status_filter)

    total_query = select(func.count(Article.id))
    if project_id:
        total_query = total_query.where(Article.project_id == project_id)
    if status_filter:
        total_query = total_query.where(Article.status == status_filter)

    total = await db.scalar(total_query)
    result = await db.execute(query.offset(skip).limit(limit))
    articles = list(result.scalars().all())

    return ArticleListResponse(articles=articles, total=total or 0)


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: uuid.UUID,
    data: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(article, field, value)

    await db.flush()
    return article


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await db.delete(article)
    await db.flush()


@router.get("/{article_id}/pdf")
async def get_article_pdf(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return FileResponse(
        article.file_path,
        media_type="application/pdf",
        filename=f"{article.title or 'article'}.pdf",
    )


@router.get("/{article_id}/pages", response_model=list[PdfPageResponse])
async def get_article_pages(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PdfPage)
        .where(PdfPage.article_id == article_id)
        .order_by(PdfPage.page_number)
    )
    pages = list(result.scalars().all())
    if not pages:
        raise HTTPException(status_code=404, detail="No page data found")
    return pages
