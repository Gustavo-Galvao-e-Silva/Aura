-- Enable pgvector extension for semantic search
-- This will be executed in the next Alembic migration

CREATE EXTENSION IF NOT EXISTS vector;
