"""Add pgvector extension and reasoning_embedding column

Revision ID: pgvector_001
Revises: ea01b2a8021f
Create Date: 2026-03-31

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = 'pgvector_001'
down_revision = 'ea01b2a8021f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Add vector column to audit_log table
    # Using 384 dimensions for 'all-MiniLM-L6-v2' sentence-transformer model
    op.add_column('audit_log',
        sa.Column('reasoning_embedding', Vector(384), nullable=True)
    )


def downgrade() -> None:
    # Remove vector column
    op.drop_column('audit_log', 'reasoning_embedding')

    # Note: We don't drop the extension in case other tables might use it
    # op.execute('DROP EXTENSION IF EXISTS vector')
