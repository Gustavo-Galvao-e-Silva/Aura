"""Initial schema - create all tables with pgvector support

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-04-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension first
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fullname', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create liabilities table
    op.create_table('liabilities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('is_predicted', sa.Boolean(), nullable=True),
        sa.Column('is_paid', sa.Boolean(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('priority_level', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['username'], ['users.username'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_liabilities_id'), 'liabilities', ['id'], unique=False)
    op.create_index(op.f('ix_liabilities_username'), 'liabilities', ['username'], unique=False)
    op.create_index(op.f('ix_liabilities_name'), 'liabilities', ['name'], unique=False)

    # Create audit_log table with vector column
    op.create_table('audit_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('decision_hash', sa.String(), nullable=True),
        sa.Column('reasoning', sa.String(), nullable=True),
        sa.Column('stellar_tx_id', sa.String(), nullable=True),
        # Add vector column directly (384 dimensions for 'all-MiniLM-L6-v2' model)
        sa.Column('reasoning_embedding', Vector(384), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('decision_hash')
    )

    # Create cotation_notify table
    op.create_table('cotation_notify',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('rate', sa.Float(), nullable=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('has_notified', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cotation_notify_id'), 'cotation_notify', ['id'], unique=False)
    op.create_index(op.f('ix_cotation_notify_username'), 'cotation_notify', ['username'], unique=False)
    op.create_index(op.f('ix_cotation_notify_email'), 'cotation_notify', ['email'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index(op.f('ix_cotation_notify_email'), table_name='cotation_notify')
    op.drop_index(op.f('ix_cotation_notify_username'), table_name='cotation_notify')
    op.drop_index(op.f('ix_cotation_notify_id'), table_name='cotation_notify')
    op.drop_table('cotation_notify')

    op.drop_table('audit_log')

    op.drop_index(op.f('ix_liabilities_name'), table_name='liabilities')
    op.drop_index(op.f('ix_liabilities_username'), table_name='liabilities')
    op.drop_index(op.f('ix_liabilities_id'), table_name='liabilities')
    op.drop_table('liabilities')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')

    # Optionally drop the vector extension (commented out to be safe)
    # op.execute('DROP EXTENSION IF EXISTS vector')
