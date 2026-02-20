import base64
import logging
from pathlib import Path

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)


class ClaudeClient:
    """Wrapper around the Anthropic SDK for structured data extraction."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-5-20250514"

    def extract_from_pdf(
        self,
        pdf_path: str,
        system_prompt: str,
        user_prompt: str,
        methodology_pdfs: list[str] | None = None,
        few_shot_examples: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 8192,
    ) -> dict:
        """Send a PDF to Claude for data extraction.

        Args:
            pdf_path: Path to the article PDF
            system_prompt: System instructions for the extraction task
            user_prompt: User message describing what to extract
            methodology_pdfs: Optional list of methodology PDF paths to include as context
            few_shot_examples: Optional formatted few-shot examples to include
            temperature: Sampling temperature (low for factual extraction)
            max_tokens: Maximum output tokens
        """
        content = []

        # Add few-shot examples as text
        if few_shot_examples:
            content.append({
                "type": "text",
                "text": few_shot_examples,
            })

        # Add methodology reference PDFs
        if methodology_pdfs:
            for ref_path in methodology_pdfs:
                ref_b64 = self._load_pdf_base64(ref_path)
                if ref_b64:
                    content.append({
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": ref_b64,
                        },
                        "cache_control": {"type": "ephemeral"},
                    })

        # Add the article PDF
        article_b64 = self._load_pdf_base64(pdf_path)
        if not article_b64:
            raise ValueError(f"Could not load PDF: {pdf_path}")

        content.append({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": article_b64,
            },
        })

        # Add the extraction instruction
        content.append({
            "type": "text",
            "text": user_prompt,
        })

        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": content}],
        )

        # Parse the response
        result_text = ""
        for block in response.content:
            if block.type == "text":
                result_text += block.text

        return {
            "text": result_text,
            "prompt_tokens": response.usage.input_tokens,
            "completion_tokens": response.usage.output_tokens,
            "model": response.model,
        }

    def _load_pdf_base64(self, pdf_path: str) -> str | None:
        path = Path(pdf_path)
        if not path.exists():
            logger.warning(f"PDF not found: {pdf_path}")
            return None
        return base64.b64encode(path.read_bytes()).decode("utf-8")


# Singleton
claude_client = ClaudeClient()
