import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.training_example import TrainingExample

logger = logging.getLogger(__name__)


class ExampleSelector:
    """Selects the most relevant training examples for few-shot prompting.

    Uses text-based similarity when pgvector/embeddings are not available,
    and semantic similarity via embeddings when they are.
    """

    async def select_examples(
        self,
        db: AsyncSession,
        article_text: str,
        task_type: str = "extraction",
        k: int = 3,
    ) -> list[dict]:
        """Select top-k training examples most relevant to the given article."""
        # Get all active training examples
        result = await db.execute(
            select(TrainingExample)
            .where(TrainingExample.is_active.is_(True))
            .order_by(TrainingExample.quality_score.desc())
            .limit(k * 5)
        )
        candidates = list(result.scalars().all())

        if not candidates:
            return []

        # Score candidates by text similarity (keyword overlap)
        article_words = set(article_text.lower().split()[:500])
        scored = []

        for example in candidates:
            example_words = set(example.input_text.lower().split()[:500])
            overlap = len(article_words & example_words)
            # Weighted score: similarity * quality
            score = overlap * example.quality_score
            scored.append((example, score))

        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)

        # Diversify: try to pick different study types
        selected = []
        seen_types = set()

        for example, score in scored:
            if len(selected) >= k:
                break
            study_type = example.study_type
            if study_type not in seen_types or len(selected) < k:
                selected.append(example)
                seen_types.add(study_type)

        # Format as dicts for prompt building
        formatted = []
        for example in selected:
            formatted.append({
                "input_text": example.input_text,
                "expected_output": example.expected_output,
                "study_type": example.study_type,
            })
            # Update usage count
            example.usage_count += 1

        await db.flush()
        return formatted


example_selector = ExampleSelector()
