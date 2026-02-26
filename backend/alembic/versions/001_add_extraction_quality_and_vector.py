"""Add extraction quality metadata columns and pgvector embedding column

Revision ID: 001_quality_vector
Revises:
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic
revision = "001_quality_vector"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add quality metadata columns to extractions table
    op.add_column("extractions", sa.Column("completeness_summary", JSONB, nullable=True))
    op.add_column("extractions", sa.Column("validation_warnings", JSONB, nullable=True))
    op.add_column("extractions", sa.Column("field_review_status", JSONB, nullable=True))
    op.add_column("extractions", sa.Column("synthesis", JSONB, nullable=True))

    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add embedding vector column (384-dim for all-MiniLM-L6-v2)
    op.execute("ALTER TABLE training_examples ADD COLUMN IF NOT EXISTS embedding_vector vector(384)")

    # Create HNSW index for fast cosine similarity search
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_training_examples_embedding_vector "
        "ON training_examples USING hnsw (embedding_vector vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_training_examples_embedding_vector")
    op.execute("ALTER TABLE training_examples DROP COLUMN IF EXISTS embedding_vector")
    op.drop_column("extractions", "synthesis")
    op.drop_column("extractions", "field_review_status")
    op.drop_column("extractions", "validation_warnings")
    op.drop_column("extractions", "completeness_summary")
