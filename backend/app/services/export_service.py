import uuid
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.article import Article
from app.models.extraction import Extraction
from app.models.grade_assessment import GradeAssessment


CERTAINTY_LABELS = {
    "high": "HIGH",
    "moderate": "MODERATE",
    "low": "LOW",
    "very_low": "VERY LOW",
}


async def export_extraction_to_word(
    db: AsyncSession,
    extraction_id: uuid.UUID,
) -> Path:
    """Export a single extraction with GRADE assessment to a Word document."""
    result = await db.execute(
        select(Extraction)
        .options(selectinload(Extraction.grade_assessments))
        .where(Extraction.id == extraction_id)
    )
    extraction = result.scalar_one_or_none()
    if not extraction:
        raise ValueError("Extraction not found")

    article_result = await db.execute(
        select(Article).where(Article.id == extraction.article_id)
    )
    article = article_result.scalar_one()

    doc = Document()
    _build_extraction_document(doc, article, extraction)

    output_path = settings.export_path / f"{uuid.uuid4()}.docx"
    doc.save(str(output_path))
    return output_path


async def export_project_to_word(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> Path:
    """Export all extractions in a project to a single Word document."""
    articles_result = await db.execute(
        select(Article)
        .where(Article.project_id == project_id)
        .order_by(Article.created_at)
    )
    articles = list(articles_result.scalars().all())

    doc = Document()
    doc.add_heading("Evidence Synthesis Report", level=0)

    for article in articles:
        ext_result = await db.execute(
            select(Extraction)
            .options(selectinload(Extraction.grade_assessments))
            .where(Extraction.article_id == article.id)
            .order_by(Extraction.version.desc())
            .limit(1)
        )
        extraction = ext_result.scalar_one_or_none()
        if extraction:
            _build_extraction_document(doc, article, extraction)
            doc.add_page_break()

    output_path = settings.export_path / f"project_{uuid.uuid4()}.docx"
    doc.save(str(output_path))
    return output_path


def _build_extraction_document(
    doc: Document,
    article: Article,
    extraction: Extraction,
) -> None:
    """Build the extraction content in a Word document."""
    # Article header
    doc.add_heading(article.title or "Untitled Article", level=1)
    if article.authors:
        doc.add_paragraph(f"Authors: {article.authors}")
    if article.journal:
        doc.add_paragraph(f"Journal: {article.journal} ({article.year or 'N/A'})")

    # Study design
    if extraction.study_design:
        doc.add_heading("Study Design", level=2)
        _add_field_data(doc, extraction.study_design)

    # Population
    if extraction.population:
        doc.add_heading("Population", level=2)
        _add_field_data(doc, extraction.population)

    # Intervention
    if extraction.intervention:
        doc.add_heading("Intervention", level=2)
        _add_field_data(doc, extraction.intervention)

    # Comparator
    if extraction.comparator:
        doc.add_heading("Comparator", level=2)
        _add_field_data(doc, extraction.comparator)

    # Outcomes
    if extraction.outcomes:
        doc.add_heading("Outcomes", level=2)
        outcomes = extraction.outcomes
        if isinstance(outcomes, list):
            for outcome in outcomes:
                _add_field_data(doc, outcome)
                doc.add_paragraph("")
        else:
            _add_field_data(doc, outcomes)

    # Additional fields
    for field_name in ["setting", "follow_up", "funding", "limitations", "conclusions"]:
        field_data = getattr(extraction, field_name, None)
        if field_data:
            doc.add_heading(field_name.replace("_", " ").title(), level=2)
            _add_field_data(doc, field_data)

    # Custom fields from template
    if extraction.custom_fields:
        doc.add_heading("Additional Extracted Data", level=2)
        _add_field_data(doc, extraction.custom_fields)

    # GRADE Assessment table
    if extraction.grade_assessments:
        doc.add_heading("GRADE Evidence Profile", level=2)
        _build_grade_table(doc, extraction.grade_assessments)


def _add_field_data(doc: Document, data: dict | list) -> None:
    """Add extracted field data to the document."""
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                _add_field_data(doc, item)
            else:
                doc.add_paragraph(str(item), style="List Bullet")
        return

    for key, value in data.items():
        if key == "source_locations":
            continue
        if isinstance(value, dict):
            doc.add_paragraph(f"{key.replace('_', ' ').title()}:")
            _add_field_data(doc, value)
        elif isinstance(value, list):
            doc.add_paragraph(f"{key.replace('_', ' ').title()}:")
            for item in value:
                if isinstance(item, dict):
                    _add_field_data(doc, item)
                else:
                    doc.add_paragraph(f"  - {item}", style="List Bullet")
        else:
            doc.add_paragraph(f"{key.replace('_', ' ').title()}: {value}")


def _build_grade_table(doc: Document, assessments: list[GradeAssessment]) -> None:
    """Build a GRADE evidence profile table."""
    headers = [
        "Outcome",
        "Risk of Bias",
        "Inconsistency",
        "Indirectness",
        "Imprecision",
        "Publication Bias",
        "Overall Certainty",
    ]

    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"

    # Header row
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = header
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.bold = True
                run.font.size = Pt(9)

    # Data rows
    for assessment in assessments:
        row = table.add_row()
        row.cells[0].text = assessment.outcome_name

        domains = [
            assessment.risk_of_bias,
            assessment.inconsistency,
            assessment.indirectness,
            assessment.imprecision,
            assessment.publication_bias,
        ]
        for i, domain in enumerate(domains):
            if domain and isinstance(domain, dict):
                rating = domain.get("rating", "N/A")
                row.cells[i + 1].text = rating.replace("_", " ").title()

        certainty = assessment.overall_certainty or "N/A"
        row.cells[6].text = CERTAINTY_LABELS.get(certainty, certainty.upper())
