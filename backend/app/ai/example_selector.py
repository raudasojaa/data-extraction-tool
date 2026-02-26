import json
import logging

import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.training_example import TrainingExample

logger = logging.getLogger(__name__)

# Lazy-loaded model singleton
_embedding_model: SentenceTransformer | None = None


def _get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(settings.embedding_model)
    return _embedding_model


def compute_embedding(text: str) -> list[float]:
    """Compute embedding vector for a text string."""
    model = _get_embedding_model()
    # Truncate to first ~1000 tokens worth of text
    truncated = " ".join(text.split()[:1000])
    embedding = model.encode(truncated, normalize_embeddings=True)
    return embedding.tolist()


class ExampleSelector:
    """Selects the most relevant training examples for few-shot prompting.

    Uses embedding-based semantic similarity via pgvector when available,
    falling back to keyword overlap.
    """

    async def select_examples(
        self,
        db: AsyncSession,
        article_text: str,
        task_type: str = "extraction",
        k: int = 3,
    ) -> list[dict]:
        """Select top-k training examples most relevant to the given article."""
        # Try embedding-based selection first
        try:
            result = await self._select_by_embedding(db, article_text, k)
            if result:
                return result
        except Exception as e:
            logger.warning("Embedding-based selection failed, falling back to keyword: %s", e)

        # Fallback: keyword overlap
        return await self._select_by_keyword(db, article_text, k)

    async def _select_by_embedding(
        self,
        db: AsyncSession,
        article_text: str,
        k: int,
    ) -> list[dict]:
        """Select examples using pgvector cosine similarity."""
        query_embedding = compute_embedding(article_text)

        # Use pgvector cosine distance operator
        # Only select examples that have embedding_vector populated
        result = await db.execute(
            text("""
                SELECT id, input_text, expected_output, study_type, quality_score,
                       1 - (embedding_vector <=> :query_vec::vector) AS similarity
                FROM training_examples
                WHERE is_active = true
                  AND embedding_vector IS NOT NULL
                ORDER BY embedding_vector <=> :query_vec::vector
                LIMIT :limit
            """),
            {
                "query_vec": str(query_embedding),
                "limit": k * 3,
            },
        )
        rows = result.fetchall()

        if not rows:
            return []

        # Diversify by study type
        selected = []
        seen_types: set[str] = set()
        for row in rows:
            if len(selected) >= k:
                break
            study_type = row.study_type
            if study_type not in seen_types or len(selected) < k:
                selected.append(row)
                seen_types.add(study_type or "")

        # Format and update usage count
        formatted = []
        for row in selected:
            formatted.append({
                "input_text": row.input_text,
                "expected_output": row.expected_output if isinstance(row.expected_output, dict) else json.loads(row.expected_output),
                "study_type": row.study_type,
            })
            # Update usage count
            await db.execute(
                text("UPDATE training_examples SET usage_count = usage_count + 1 WHERE id = :id"),
                {"id": row.id},
            )

        await db.flush()
        return formatted

    async def _select_by_keyword(
        self,
        db: AsyncSession,
        article_text: str,
        k: int,
    ) -> list[dict]:
        """Fallback: select examples by keyword overlap."""
        result = await db.execute(
            select(TrainingExample)
            .where(TrainingExample.is_active.is_(True))
            .order_by(TrainingExample.quality_score.desc())
            .limit(k * 5)
        )
        candidates = list(result.scalars().all())

        if not candidates:
            return []

        article_words = set(article_text.lower().split()[:500])
        scored = []

        for example in candidates:
            example_words = set(example.input_text.lower().split()[:500])
            overlap = len(article_words & example_words)
            score = overlap * example.quality_score
            scored.append((example, score))

        scored.sort(key=lambda x: x[1], reverse=True)

        selected = []
        seen_types: set[str | None] = set()

        for example, score in scored:
            if len(selected) >= k:
                break
            study_type = example.study_type
            if study_type not in seen_types or len(selected) < k:
                selected.append(example)
                seen_types.add(study_type)

        formatted = []
        for example in selected:
            formatted.append({
                "input_text": example.input_text,
                "expected_output": example.expected_output,
                "study_type": example.study_type,
            })
            example.usage_count += 1

        await db.flush()
        return formatted


example_selector = ExampleSelector()
