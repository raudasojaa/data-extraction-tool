import hashlib
import uuid
from difflib import SequenceMatcher
from pathlib import Path

import pymupdf
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.article import Article
from app.models.pdf_page import PdfPage


def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


async def upload_and_process_pdf(
    db: AsyncSession,
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
) -> Article:
    file_hash = compute_file_hash(file_bytes)

    # Store file
    file_id = str(uuid.uuid4())
    file_path = settings.upload_path / f"{file_id}.pdf"
    file_path.write_bytes(file_bytes)

    # Extract basic metadata and page data
    doc = pymupdf.open(str(file_path))
    page_count = len(doc)

    # Try to extract title from first page (largest font text)
    title = _extract_title(doc)

    article = Article(
        uploaded_by=user_id,
        title=title,
        file_path=str(file_path),
        file_hash=file_hash,
        page_count=page_count,
        status="uploaded",
        project_id=project_id,
    )
    db.add(article)
    await db.flush()

    # Extract per-page text and word coordinate data
    for page_num in range(page_count):
        page = doc[page_num]
        page_data = _extract_page_data(page, page_num)
        pdf_page = PdfPage(
            article_id=article.id,
            page_number=page_data["page_number"],
            width=page_data["width"],
            height=page_data["height"],
            text_content=page_data["text_content"],
            word_data=page_data["word_data"],
        )
        db.add(pdf_page)

    doc.close()
    article.status = "processing"
    await db.flush()
    return article


def _extract_title(doc: pymupdf.Document) -> str | None:
    if len(doc) == 0:
        return None

    page = doc[0]
    blocks = page.get_text("dict", sort=True)["blocks"]

    max_font_size = 0
    title_text = ""

    for block in blocks:
        if "lines" not in block:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                if span["size"] > max_font_size:
                    max_font_size = span["size"]
                    title_text = span["text"]
                elif span["size"] == max_font_size:
                    title_text += " " + span["text"]

    return title_text.strip()[:500] if title_text.strip() else None


def _extract_page_data(page: pymupdf.Page, page_num: int) -> dict:
    words = page.get_text("words", sort=True)

    word_data = [
        {
            "text": w[4],
            "x0": round(w[0], 2),
            "y0": round(w[1], 2),
            "x1": round(w[2], 2),
            "y1": round(w[3], 2),
            "block": w[5],
            "line": w[6],
            "word": w[7],
        }
        for w in words
    ]

    return {
        "page_number": page_num + 1,
        "width": page.rect.width,
        "height": page.rect.height,
        "text_content": page.get_text("text", sort=True),
        "word_data": word_data,
    }


def find_quote_locations(pdf_path: str, quote: str) -> list[dict]:
    """Find bounding box locations for a verbatim quote in the PDF."""
    doc = pymupdf.open(pdf_path)
    locations = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        quads = page.search_for(quote, quads=True)

        for quad in quads:
            rect = quad.rect
            locations.append({
                "page": page_num + 1,
                "x0": round(rect.x0 / page.rect.width, 4),
                "y0": round(rect.y0 / page.rect.height, 4),
                "x1": round(rect.x1 / page.rect.width, 4),
                "y1": round(rect.y1 / page.rect.height, 4),
                "text": quote,
            })

        if locations:
            break  # Found on this page, stop searching

    doc.close()

    # Fuzzy fallback if exact search fails
    if not locations:
        locations = _fuzzy_find_quote(pdf_path, quote)

    return locations


def _fuzzy_find_quote(pdf_path: str, quote: str, threshold: float = 0.85) -> list[dict]:
    """Fuzzy match a quote against page text when exact search fails."""
    doc = pymupdf.open(pdf_path)
    locations = []

    quote_lower = quote.lower()
    quote_len = len(quote_lower)

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_text = page.get_text("text", sort=True).lower()

        if len(page_text) < quote_len:
            continue

        best_ratio = 0
        best_pos = -1

        # Sliding window search (step by words for efficiency)
        step = max(1, quote_len // 10)
        for i in range(0, len(page_text) - quote_len + 1, step):
            window = page_text[i : i + quote_len]
            ratio = SequenceMatcher(None, quote_lower, window).quick_ratio()
            if ratio > best_ratio:
                # Full ratio check only for promising candidates
                ratio = SequenceMatcher(None, quote_lower, window).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_pos = i

        if best_ratio >= threshold and best_pos >= 0:
            matched_text = page.get_text("text", sort=True)[best_pos : best_pos + quote_len]
            # Get approximate bounding box using word-level data
            words = page.get_text("words", sort=True)
            if words:
                # Find words overlapping the character range
                char_count = 0
                relevant_words = []
                for w in words:
                    word_start = char_count
                    word_end = char_count + len(w[4]) + 1  # +1 for space
                    if word_end > best_pos and word_start < best_pos + quote_len:
                        relevant_words.append(w)
                    char_count = word_end

                if relevant_words:
                    x0 = min(w[0] for w in relevant_words)
                    y0 = min(w[1] for w in relevant_words)
                    x1 = max(w[2] for w in relevant_words)
                    y1 = max(w[3] for w in relevant_words)
                    locations.append({
                        "page": page_num + 1,
                        "x0": round(x0 / page.rect.width, 4),
                        "y0": round(y0 / page.rect.height, 4),
                        "x1": round(x1 / page.rect.width, 4),
                        "y1": round(y1 / page.rect.height, 4),
                        "text": matched_text,
                    })
            break

    doc.close()
    return locations
