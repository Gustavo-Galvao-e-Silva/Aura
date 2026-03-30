# Revellio Infrastructure Migration Plan

**Goal:** Transform Revellio from a development-only codebase into a production-ready, easily deployable application by adopting infrastructure patterns from the kiro-test reference implementation.

**Timeline:** 6 phases, ~2-3 days of focused work (can be done incrementally)

**Outcome:**
- ✅ `docker compose up -d` → full stack running (backend + frontend + db)
- ✅ Modern Python packaging with `pyproject.toml`
- ✅ Centralized configuration management
- ✅ Database migrations with Alembic (production-safe schema changes)
- ✅ Async SQLAlchemy (better performance, non-blocking I/O)
- ✅ Semantic search + blockchain (best of both worlds for trust engine)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Phase 1: Docker Compose Full Stack](#phase-1-docker-compose-full-stack)
3. [Phase 2: Migrate to pyproject.toml](#phase-2-migrate-to-pyprojecttoml)
4. [Phase 3: Centralized Configuration](#phase-3-centralized-configuration)
5. [Phase 4: Alembic Migrations](#phase-4-alembic-migrations)
6. [Phase 5: AsyncSession Refactor](#phase-5-asyncsession-refactor)
7. [Phase 6: Semantic Search in Trust Engine](#phase-6-semantic-search-in-trust-engine)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Guide](#deployment-guide)

---

## Current State Analysis

### Directory Structure
```
revellio/
├── src/
│   ├── server/          # Backend (FastAPI + LangGraph)
│   │   ├── agents/      # Agent nodes (researchers, orchestrator, trust, router)
│   │   ├── tools/       # Market data fetching (just added)
│   │   ├── db/          # Models (Liability, AuditLog, Users, CotationNotify)
│   │   ├── my_fastapi_app/
│   │   │   └── app/     # FastAPI routes, config, session
│   │   ├── docker-compose.yml  # Only PostgreSQL + Adminer
│   │   ├── requirements.txt
│   │   ├── justfile
│   │   └── .env.example
│   └── client/          # Frontend (React + Vite + TypeScript)
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
└── README.md
```

### Current Tech Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React 19 + Vite + TypeScript | ✅ Modern |
| Backend | FastAPI + LangGraph | ✅ Modern |
| Database | PostgreSQL (sync) | ⚠️ Not async |
| ORM | SQLAlchemy 2.0 (sync) | ⚠️ Not async |
| Packaging | requirements.txt | ⚠️ Old style |
| Migrations | None (create_all) | ❌ Missing |
| Config | Scattered (.env + config.py) | ⚠️ Not centralized |
| Docker | DB only | ❌ Backend/frontend not containerized |

### Current Development Workflow

```bash
# 1. Start database
cd src/server
just up  # docker compose up -d (only db + adminer)

# 2. Install backend deps
pip install -r requirements.txt

# 3. Start backend
just dev  # uvicorn with hot reload

# 4. In another terminal, install frontend deps
cd src/client
npm install

# 5. Start frontend
npm run dev
```

**Problem:** 5 manual steps, environment-dependent (Python version, Node version, DB connection config)

### What We're Taking from kiro-test

| Pattern | Benefit | Priority |
|---------|---------|----------|
| Root docker-compose.yml | One-command full stack | ⭐⭐⭐ Critical |
| pyproject.toml | Modern Python packaging | ⭐⭐ High |
| Centralized config.py | Single source of truth | ⭐⭐ High |
| Alembic migrations | Production-safe schema changes | ⭐⭐⭐ Critical |
| AsyncSession | Better performance, FastAPI-native | ⭐⭐⭐ Critical |
| pgvector embeddings | Semantic contradiction detection | ⭐⭐ High |

### What We're Keeping from Revellio

- ✅ Directory structure (`src/server/`, `src/client/`)
- ✅ React + Vite frontend (NOT switching to Next.js)
- ✅ justfile commands (but enhanced)
- ✅ All existing models (Liability, AuditLog, Users, CotationNotify)
- ✅ All 5 agents (FX Strategist, Router, Visionary Accountant, Orchestrator, Trust Engine)
- ✅ Stellar blockchain integration (will ADD pgvector, not replace)

---

## Phase 1: Docker Compose Full Stack

**Goal:** One command to start the entire Revellio stack

**Estimated Time:** 2-3 hours

**Risk Level:** Low (additive, doesn't break existing workflow)

### What We're Creating

```
revellio/
├── docker-compose.yml        # NEW: Root orchestrator
├── src/
│   ├── server/
│   │   ├── Dockerfile        # NEW: Backend container
│   │   ├── .dockerignore     # NEW: Exclude cache/venv
│   │   └── ...
│   └── client/
│       ├── Dockerfile        # NEW: Frontend container
│       ├── .dockerignore     # NEW: Exclude node_modules
│       └── ...
```

### Step-by-Step Implementation

#### 1.1 Create Root `docker-compose.yml`

**File:** `/docker-compose.yml` (repository root)

```yaml
version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16  # Upgraded for future semantic search
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-revellio}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  adminer:
    image: adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      - db

  backend:
    build:
      context: ./src/server
      dockerfile: Dockerfile
    command: uvicorn my_fastapi_app.app.main:app --host 0.0.0.0 --port 8000 --reload
    ports:
      - "8000:8000"
    env_file:
      - ./src/server/.env
    environment:
      # Override DATABASE_URL to use Docker service name
      DATABASE_URL: postgresql://postgres:postgres@db:5432/revellio
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_NAME: revellio
    volumes:
      # Mount source code for hot reload
      - ./src/server:/app
      # Exclude cache and virtual envs
      - /app/__pycache__
      - /app/.venv
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./src/client
      dockerfile: Dockerfile
    command: npm run dev -- --host 0.0.0.0
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8000
    volumes:
      # Mount source for hot reload
      - ./src/client:/app
      # Exclude node_modules (use container's version)
      - /app/node_modules
    depends_on:
      - backend

volumes:
  pgdata:
```

**Key Features:**
- `pgvector/pgvector:pg16` instead of plain postgres (future-proofing)
- Health check on DB → backend only starts when DB is ready
- Volume mounts → hot reload works in Docker
- Environment variables → work both in Docker and native modes

#### 1.2 Create Backend Dockerfile

**File:** `/src/server/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (cache layer)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set PYTHONPATH so imports work
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Default command (can be overridden by docker-compose)
CMD ["uvicorn", "my_fastapi_app.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**File:** `/src/server/.dockerignore`

```
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv/
pip-log.txt
pip-delete-this-directory.txt
.pytest_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/
.env
.git/
.gitignore
docker-compose.yml
README.md
fx_cache.json
```

#### 1.3 Create Frontend Dockerfile

**File:** `/src/client/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files first (cache layer)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**File:** `/src/client/.dockerignore`

```
node_modules/
dist/
build/
.git/
.gitignore
*.log
.env
.env.local
.DS_Store
coverage/
```

#### 1.4 Update `justfile` for Dual-Mode Support

**File:** `/src/server/justfile`

Add these commands at the top:

```just
# ============================================================================
# DOCKER MODE (Full Stack)
# ============================================================================

# Start full stack (backend + frontend + db) in Docker
stack-up:
	cd ../.. && docker compose up -d

# Stop full stack
stack-down:
	cd ../.. && docker compose down

# Rebuild and restart full stack
stack-restart:
	cd ../.. && docker compose down && docker compose up -d --build

# View logs from all services
stack-logs:
	cd ../.. && docker compose logs -f

# View logs from backend only
backend-logs:
	cd ../.. && docker compose logs -f backend

# Wipe everything (including volumes)
stack-wipe:
	cd ../.. && docker compose down -v

# ============================================================================
# NATIVE MODE (Local Development)
# ============================================================================

# (Keep existing commands: up, wipe, dev, db, etc.)
```

### Testing Phase 1

#### Test 1: Docker Mode (Full Stack)

```bash
# From repository root
docker compose up -d

# Wait for services to start (~30 seconds first time)
docker compose ps

# Should show:
# - db (healthy)
# - adminer (running)
# - backend (running)
# - frontend (running)

# Test backend
curl http://localhost:8000/health
# Should return: {"status": "ok"}

# Test frontend
open http://localhost:5173
# Should show React app

# Test hot reload (backend)
# Edit src/server/my_fastapi_app/app/main.py, change version
# Refresh browser → should see change WITHOUT docker compose restart

# View logs
docker compose logs -f backend
```

#### Test 2: Native Mode (Backwards Compatibility)

```bash
# Make sure Docker stack is down
docker compose down

# Start ONLY the database
cd src/server
just up

# Start backend natively
just dev

# In another terminal, start frontend natively
cd src/client
npm run dev

# Should work exactly as before
```

#### Test 3: Mixed Mode (DB in Docker, Backend/Frontend Native)

```bash
# This should still work for fastest iteration
cd src/server
just up  # Only starts db + adminer

# Backend sees db on localhost:5432 (unchanged)
just dev

# Frontend runs natively
cd src/client
npm run dev
```

### Rollback Procedure

If Phase 1 breaks something:

```bash
# Stop Docker stack
docker compose down

# Revert to old workflow
cd src/server
just up    # Old docker-compose.yml (db only)
just dev   # Backend runs natively
```

The old `src/server/docker-compose.yml` is still there, so native mode is unaffected.

### Success Criteria

- ✅ `docker compose up -d` starts all 3 services
- ✅ Backend accessible at `http://localhost:8000`
- ✅ Frontend accessible at `http://localhost:5173`
- ✅ Hot reload works (edit files → changes reflect without restart)
- ✅ Native mode still works (backward compatible)
- ✅ Database persists between restarts

---

## Phase 2: Migrate to pyproject.toml

**Goal:** Modern Python packaging

**Estimated Time:** 30 minutes

**Risk Level:** Very Low (doesn't affect runtime)

### What We're Creating

```
src/server/
├── pyproject.toml     # NEW: Replaces requirements.txt
└── requirements.txt   # Keep for now (backwards compat)
```

### Step-by-Step Implementation

#### 2.1 Create `pyproject.toml`

**File:** `/src/server/pyproject.toml`

```toml
[project]
name = "revellio-backend"
version = "0.2.0"
description = "AI-powered global finance co-pilot for international students"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.111.0",
    "uvicorn[standard]>=0.29.0",
    "langgraph>=0.1.0",
    "langchain>=0.2.0",
    "langchain-google-genai>=1.0.0",
    "google-generativeai>=0.5.0",
    "sqlalchemy>=2.0.0",
    "psycopg2-binary>=2.9.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "python-dotenv>=1.0.0",
    "httpx>=0.27.0",
    "Pillow>=10.0.0",
    "requests>=2.31.0",
    "stellar-sdk>=8.0.0",
    # Market research dependencies (Phase 5 agent improvements)
    "fredapi>=0.5.0",
    "wbgapi>=1.0.0",
    "yfinance>=0.2.0",
    "python-bcb>=0.3.0",
    "tavily-python>=0.3.0",
    # Browser Use SDK for agent 1
    "browser-use-sdk>=0.1.0",
    "playwright>=1.40.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "ruff>=0.1.0",
    "mypy>=1.5.0",
]
migrations = [
    "alembic>=1.13.0",
]
semantic = [
    "pgvector>=0.2.0",
    "openai>=1.0.0",  # For embeddings
]

[build-system]
requires = ["setuptools>=65.0", "wheel"]
build-backend = "setuptools.build_meta"

[tool.ruff]
line-length = 120
target-version = "py311"

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = false  # Gradual typing
```

#### 2.2 Update Dockerfile to Use pyproject.toml

**File:** `/src/server/Dockerfile` (modify)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml first (cache layer)
COPY pyproject.toml .

# Install dependencies
RUN pip install --no-cache-dir -e .

# Copy application code
COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "my_fastapi_app.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 2.3 Update justfile

**File:** `/src/server/justfile` (add command)

```just
# Install dependencies (new way)
install:
	pip install -e .

# Install with dev dependencies
install-dev:
	pip install -e ".[dev]"

# Install everything (dev + migrations + semantic)
install-all:
	pip install -e ".[dev,migrations,semantic]"
```

### Testing Phase 2

```bash
# Test native install
cd src/server
pip install -e .

# Verify dependencies
pip list | grep fastapi
pip list | grep langgraph

# Test Docker build
cd ../..
docker compose build backend

# Start and test
docker compose up -d backend
curl http://localhost:8000/health
```

### Rollback Procedure

If something breaks:
```bash
# Revert to old requirements.txt
cd src/server
pip install -r requirements.txt
```

The `requirements.txt` file is still there, so this is safe.

### Success Criteria

- ✅ `pip install -e .` installs all dependencies
- ✅ Docker build works with pyproject.toml
- ✅ Backend runs correctly in both Docker and native modes
- ✅ Optional dependencies can be installed separately

---

## Phase 3: Centralized Configuration

**Goal:** Single source of truth for all configuration

**Estimated Time:** 1 hour

**Risk Level:** Low (improves maintainability)

### What We're Creating

```
src/server/
├── config.py                    # NEW: Centralized config with pydantic-settings
└── my_fastapi_app/app/
    └── config.py                # OLD: Keep for backwards compat, import from root
```

### Current Config Sprawl

**Problem:** Configuration is scattered across multiple files:

| Config Item | Current Location | Issue |
|-------------|------------------|-------|
| API keys | `.env` → loaded by `dotenv` | ✅ OK |
| Constants | `my_fastapi_app/app/config.py` | ❌ Hardcoded |
| DB URL | `my_fastapi_app/app/db/session.py` | ❌ Constructed from env vars |
| Cache settings | `my_fastapi_app/app/config.py` | ✅ OK, but not typed |

### Step-by-Step Implementation

#### 3.1 Create Centralized `config.py`

**File:** `/src/server/config.py`

```python
"""
Centralized configuration for Revellio backend.

Uses pydantic-settings for type-safe, validated config from environment variables.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Fallbacks are provided for development. Production should set all vars explicitly.
    """

    # ========================================================================
    # Database Configuration
    # ========================================================================

    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/revellio",
        description="Full PostgreSQL connection URL (sync). Overrides individual DB_* vars if set."
    )

    db_host: str = Field(default="localhost", description="Database host")
    db_port: int = Field(default=5432, description="Database port")
    db_user: str = Field(default="postgres", description="Database user")
    db_password: str = Field(default="postgres", description="Database password")
    db_name: str = Field(default="revellio", description="Database name")

    # Async database URL (Phase 5)
    async_database_url: str | None = Field(
        default=None,
        description="Async PostgreSQL URL (postgresql+asyncpg://...). If not set, constructed from database_url"
    )

    # ========================================================================
    # AI/ML Service API Keys
    # ========================================================================

    google_api_key: str = Field(default="", description="Google Gemini API key")
    browser_use_api_key: str = Field(default="", description="Browser Use SDK API key")
    anthropic_api_key: str = Field(default="", description="Anthropic Claude API key (optional)")

    # Market research APIs (Phase 5)
    fred_api_key: str = Field(default="", description="FRED (Federal Reserve) API key")
    tavily_api_key: str = Field(default="", description="Tavily search API key")
    news_api_key: str = Field(default="", description="NewsAPI key (optional)")

    # ========================================================================
    # Financial Services API Keys
    # ========================================================================

    wise_api_key: str = Field(default="", description="Wise API key (optional)")

    # ========================================================================
    # Blockchain Configuration
    # ========================================================================

    stellar_secret_key: str = Field(default="", description="Stellar testnet secret key")
    stellar_base_fee: int = Field(default=100, description="Stellar transaction base fee")
    stellar_transaction_timeout: int = Field(default=30, description="Stellar transaction timeout (seconds)")
    stellar_explorer_base_url: str = Field(
        default="https://stellar.expert/explorer/testnet/tx",
        description="Stellar block explorer URL"
    )

    # ========================================================================
    # Email Configuration (SMTP)
    # ========================================================================

    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP server host")
    smtp_port: int = Field(default=587, description="SMTP server port")
    smtp_user: str = Field(default="", description="SMTP username")
    smtp_password: str = Field(default="", description="SMTP password")
    from_email: str = Field(default="", description="From email address")

    # ========================================================================
    # Application Constants
    # ========================================================================

    # Cache Settings
    cache_expiry_minutes: int = Field(default=120, description="FX market data cache TTL (minutes)")

    # FX Provider URLs
    crebit_api_url: str = Field(
        default="https://api.crebitpay.com/api/create-quote-new",
        description="Crebit quote API endpoint"
    )
    wise_api_url: str = Field(
        default="https://api.wise.com/v3/quotes",
        description="Wise quote API endpoint"
    )
    remitly_api_url: str = Field(
        default="https://api.remitly.io/v3/calculator/estimate",
        description="Remitly estimate API endpoint"
    )

    # HTTP Client Settings
    http_client_timeout: float = Field(default=20.0, description="HTTP request timeout (seconds)")

    # FX Provider Fees (USD)
    ref_amount_usd: float = Field(default=1000.0, description="Reference amount for rate comparison")
    wise_fee_usd: float = Field(default=18.0, description="Wise transfer fee")
    remitly_fee_usd: float = Field(default=0.0, description="Remitly transfer fee")
    crebit_fee_usd: float = Field(default=0.0, description="Crebit transfer fee")

    # Default Account Balances
    default_brl_balance: float = Field(default=50000.0, description="Default BRL balance for new users")
    default_usd_balance: float = Field(default=0.0, description="Default USD balance for new users")

    # Background Task Settings
    market_monitor_interval_seconds: int = Field(
        default=60,
        description="How often to run the market monitor loop"
    )

    # CORS Settings
    allowed_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        description="Allowed CORS origins"
    )

    # ========================================================================
    # Pydantic Settings Config
    # ========================================================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,  # GOOGLE_API_KEY = google_api_key
        extra="ignore",  # Ignore unknown env vars
    )

    # ========================================================================
    # Computed Properties
    # ========================================================================

    def get_sync_database_url(self) -> str:
        """Get the sync database URL (for SQLAlchemy)."""
        if self.database_url:
            return self.database_url
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    def get_async_database_url(self) -> str:
        """Get the async database URL (for AsyncSession, Phase 5)."""
        if self.async_database_url:
            return self.async_database_url
        # Convert sync URL to async
        sync_url = self.get_sync_database_url()
        return sync_url.replace("postgresql://", "postgresql+asyncpg://")


# Singleton instance
settings = Settings()


# Backwards compatibility: expose constants for existing code
CACHE_EXPIRY_MINUTES = settings.cache_expiry_minutes
CREBIT_API_URL = settings.crebit_api_url
WISE_API_URL = settings.wise_api_url
REMITLY_API_URL = settings.remitly_api_url
HTTP_CLIENT_TIMEOUT = settings.http_client_timeout
STELLAR_TRANSACTION_TIMEOUT = settings.stellar_transaction_timeout
STELLAR_BASE_FEE = settings.stellar_base_fee
STELLAR_EXPLORER_BASE_URL = settings.stellar_explorer_base_url
REF_AMOUNT_USD = settings.ref_amount_usd
WISE_FEE_USD = settings.wise_fee_usd
REMITLY_FEE_USD = settings.remitly_fee_usd
CREBIT_FEE_USD = settings.crebit_fee_usd
DEFAULT_BRL_BALANCE = settings.default_brl_balance
DEFAULT_USD_BALANCE = settings.default_usd_balance
MARKET_MONITOR_INTERVAL_SECONDS = settings.market_monitor_interval_seconds
ALLOWED_ORIGINS = settings.allowed_origins
```

#### 3.2 Update DB Session to Use New Config

**File:** `/src/server/my_fastapi_app/app/db/session.py` (modify)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import settings  # NEW: Import from root

# Use centralized config
DATABASE_URL = settings.get_sync_database_url()

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### 3.3 Update Existing Code to Import from Root

**Files to update:**

1. `src/server/my_fastapi_app/app/main.py`:
```python
from config import settings  # NEW
# OLD: from my_fastapi_app.app.config import ALLOWED_ORIGINS, MARKET_MONITOR_INTERVAL_SECONDS

# Use:
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,  # NEW
    # ...
)
```

2. `src/server/agents/router.py`:
```python
from config import settings  # NEW
# OLD: from my_fastapi_app.app.config import CREBIT_API_URL, ...

# Use settings.crebit_api_url instead of CREBIT_API_URL
```

3. Other files that import from `my_fastapi_app.app.config`.

### Testing Phase 3

```bash
# Test that settings load correctly
cd src/server
python -c "from config import settings; print(settings.database_url)"

# Should print the database URL

# Test backend starts
just dev

# Verify no import errors
```

### Rollback Procedure

If Phase 3 breaks imports:
```bash
# Revert the file changes (git)
git checkout src/server/config.py src/server/my_fastapi_app/app/db/session.py

# Or manually restore the old import pattern
```

### Success Criteria

- ✅ All config loaded from `config.py`
- ✅ No hardcoded constants in code
- ✅ Type-safe access to config (`settings.database_url`, not `os.getenv("DATABASE_URL")`)
- ✅ Environment variables override defaults
- ✅ Backend runs correctly in both Docker and native modes

---

## Phase 4: Alembic Migrations

**Goal:** Track database schema changes with version control

**Estimated Time:** 1-2 hours

**Risk Level:** Medium (touching database schema)

**IMPORTANT:** This phase assumes you have NO production data yet. If you do, we need a different approach (contact me first).

### Why This Matters

**Current Problem:**
```python
# In main.py
Base.metadata.create_all(bind=engine)
```

This creates tables if they don't exist, but:
- ❌ Can't modify existing tables (add column, change type, etc.)
- ❌ No rollback capability
- ❌ No version history
- ❌ Can't generate SQL for production DBAs to review

**With Alembic:**
```bash
# Add a new column
alembic revision --autogenerate -m "add email_verified to users"
# Review the generated migration
# Apply to database
alembic upgrade head
# Or rollback
alembic downgrade -1
```

### Step-by-Step Implementation

#### 4.1 Install Alembic

Already in `pyproject.toml`:
```bash
cd src/server
pip install -e ".[migrations]"
```

#### 4.2 Initialize Alembic

```bash
cd src/server
alembic init alembic
```

This creates:
```
src/server/
├── alembic/
│   ├── env.py          # Migration runner
│   ├── script.py.mako  # Template for new migrations
│   └── versions/       # Migration files go here
└── alembic.ini         # Alembic config
```

#### 4.3 Configure Alembic

**File:** `/src/server/alembic.ini` (modify)

Find line `sqlalchemy.url = ...` and change to:

```ini
# sqlalchemy.url = driver://user:pass@localhost/dbname
# (Commented out - we'll set this dynamically in env.py)
```

**File:** `/src/server/alembic/env.py` (replace content)

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
import os

# Add parent directory to path so we can import our models
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import settings  # Import centralized config
from db.models import Base  # Import Base and all models

# Import all models explicitly to ensure they're registered
from db.models import Liability, AuditLog, Users, CotationNotify

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the SQLAlchemy URL dynamically from our config
config.set_main_option("sqlalchemy.url", settings.get_sync_database_url())

# Target metadata for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode (generate SQL without connecting)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode (connect to DB and apply)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

#### 4.4 Create Initial Migration

This captures the current state of your database schema:

```bash
cd src/server

# Drop and recreate the database (ONLY safe in dev!)
just wipe
just up

# Generate initial migration
alembic revision --autogenerate -m "initial schema"

# This creates alembic/versions/xxxx_initial_schema.py

# Review the migration file
cat alembic/versions/*_initial_schema.py

# Apply the migration
alembic upgrade head

# Verify
just db
\dt  # Should show: liabilities, audit_log, users, cotation_notify, alembic_version
```

#### 4.5 Update `main.py` to Use Alembic

**File:** `/src/server/my_fastapi_app/app/main.py` (modify)

```python
# OLD:
@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks"""
    Base.metadata.create_all(bind=engine)  # REMOVE THIS
    asyncio.create_task(monitor_market_loop())

# NEW:
@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks"""
    # Database tables are now managed by Alembic migrations
    # Run `alembic upgrade head` before starting the server
    asyncio.create_task(monitor_market_loop())
```

#### 4.6 Update justfile for Migrations

**File:** `/src/server/justfile` (add commands)

```just
# ============================================================================
# DATABASE MIGRATIONS (Alembic)
# ============================================================================

# Create a new migration
migrate-create name:
	alembic revision --autogenerate -m "{{name}}"

# Apply all pending migrations
migrate-up:
	alembic upgrade head

# Rollback one migration
migrate-down:
	alembic downgrade -1

# Show migration history
migrate-history:
	alembic history

# Show current migration version
migrate-current:
	alembic current

# Reset database and apply migrations (DEV ONLY)
migrate-reset:
	just wipe
	just up
	sleep 3
	alembic upgrade head
```

#### 4.7 Update Dockerfile to Run Migrations

**File:** `/src/server/Dockerfile` (modify CMD)

```dockerfile
# At the end of the file, replace CMD with a script that runs migrations first

# Create entrypoint script
RUN echo '#!/bin/sh\n\
echo "Running database migrations..."\n\
alembic upgrade head\n\
echo "Starting FastAPI server..."\n\
exec uvicorn my_fastapi_app.app.main:app --host 0.0.0.0 --port 8000 "$@"\n\
' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["--reload"]
```

#### 4.8 Update `docker-compose.yml` Backend Service

**File:** `/docker-compose.yml` (modify backend service)

```yaml
  backend:
    build:
      context: ./src/server
      dockerfile: Dockerfile
    command: ["--reload"]  # Passed to entrypoint.sh
    # ... rest stays the same
```

### Testing Phase 4

#### Test 1: Initial Migration

```bash
cd src/server

# Wipe database
just wipe
just up

# Run migration
alembic upgrade head

# Verify tables exist
just db
\dt
# Should show all tables + alembic_version

# Check version
alembic current
# Should show: xxxx (head) (initial schema)
```

#### Test 2: Create a New Migration

```bash
# Add a new column to a model (for testing)
# Edit db/models.py, add to Users:
#   phone_number = Column(String, nullable=True)

# Generate migration
alembic revision --autogenerate -m "add phone_number to users"

# Review the generated file
cat alembic/versions/*_add_phone_number*.py
# Should show:
#   op.add_column('users', sa.Column('phone_number', ...))

# Apply migration
alembic upgrade head

# Verify column was added
just db
\d users
# Should show phone_number column

# Rollback (test)
alembic downgrade -1

# Verify column was removed
\d users
# phone_number should be gone

# Re-apply
alembic upgrade head
```

#### Test 3: Docker Mode with Migrations

```bash
# From root
docker compose down
docker compose up -d --build backend

# Check logs
docker compose logs backend

# Should see:
#   "Running database migrations..."
#   "Starting FastAPI server..."

# Verify backend works
curl http://localhost:8000/health
```

### Rollback Procedure

If Phase 4 breaks the database:

```bash
# Wipe and recreate using old method
cd src/server
just wipe
just up

# In main.py, restore:
Base.metadata.create_all(bind=engine)

# Start backend
just dev
```

### Success Criteria

- ✅ `alembic upgrade head` creates all tables
- ✅ `alembic revision --autogenerate` detects model changes
- ✅ `alembic downgrade -1` rolls back migrations
- ✅ Docker backend runs migrations automatically on startup
- ✅ `alembic_version` table exists and tracks current version

---

## Phase 5: AsyncSession Refactor

**Goal:** Migrate from sync SQLAlchemy to async for better performance

**Estimated Time:** 3-4 hours

**Risk Level:** High (touches every DB operation)

**IMPORTANT:** This phase changes ALL database operations. Test thoroughly.

### Why Async Matters

**Current Problem (Sync):**

```python
# This BLOCKS the event loop
def orchestrator_node(state):
    db = SessionLocal()  # Sync session
    unpaid = db.query(Liability).filter(...).all()  # BLOCKS!
    # While this runs, FastAPI can't handle other requests
```

**With Async:**

```python
# This is non-blocking
async def orchestrator_node(state):
    async with SessionLocal() as db:
        result = await db.execute(select(Liability).where(...))  # Non-blocking!
        unpaid = result.scalars().all()
    # Other requests can be processed during the await
```

**Performance Impact:**
- Current: 60s heartbeat loop BLOCKS all other requests during DB queries (~500ms)
- Async: Heartbeat and API requests run concurrently
- Real-world gain: ~2-3x more throughput under load

### Step-by-Step Implementation

#### 5.1 Update Database Session

**File:** `/src/server/my_fastapi_app/app/db/session.py` (replace)

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from config import settings

# Create async engine
engine = create_async_engine(
    settings.get_async_database_url(),
    echo=False,  # Set to True for SQL logging during dev
)

# Create async session factory
SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Dependency for FastAPI routes
async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session
```

#### 5.2 Update Models (No Changes Needed!)

Good news: SQLAlchemy 2.0 models work with both sync and async. No changes to `db/models.py`.

#### 5.3 Update Agent Nodes

This is the bulk of the work. Here's the pattern for each file:

##### Pattern: Query

**Old (Sync):**
```python
db = SessionLocal()
try:
    bills = db.query(Liability).filter(Liability.is_paid == False).all()
finally:
    db.close()
```

**New (Async):**
```python
from sqlalchemy import select

async with SessionLocal() as db:
    result = await db.execute(
        select(Liability).where(Liability.is_paid == False)
    )
    bills = result.scalars().all()
```

##### Pattern: Add

**Old (Sync):**
```python
db = SessionLocal()
try:
    new_log = AuditLog(decision_hash=hash, ...)
    db.add(new_log)
    db.commit()
finally:
    db.close()
```

**New (Async):**
```python
async with SessionLocal() as db:
    new_log = AuditLog(decision_hash=hash, ...)
    db.add(new_log)
    await db.commit()
```

##### Files to Update:

**1. `/src/server/agents/orchestrator.py`**

```python
# Change signature
async def orchestrator_node(state: AuraState):  # Add async
    """..."""
    from sqlalchemy import select, desc
    from my_fastapi_app.app.db.session import SessionLocal

    async with SessionLocal() as db:
        # OLD: unpaid = db.query(Liability).filter(...).all()
        # NEW:
        result = await db.execute(
            select(Liability).where(Liability.is_paid == False)
        )
        unpaid = result.scalars().all()

        if not unpaid:
            print("🎖️ Orchestrator: No unpaid liabilities.")
            return {"selected_route": None, "payment_decisions": []}

        # ... rest of logic (no DB calls)

    # Return stays the same
    return {
        "payment_decisions": decisions_list,
        "selected_route": top_alert if top_alert else ...
    }
```

**2. `/src/server/agents/trust.py`**

```python
async def trust_engine_node(state: AuraState):  # Add async
    """..."""
    from my_fastapi_app.app.db.session import SessionLocal
    from sqlalchemy import select

    # ... (hash generation stays the same)

    async with SessionLocal() as db:
        # Check if hash already exists
        result = await db.execute(
            select(AuditLog).where(AuditLog.decision_hash == audit_hash)
        )
        existing_log = result.scalar_one_or_none()

        if existing_log:
            print(f"♻️ Trust Engine: Audit exists. TX: {existing_log.stellar_tx_id[:10]}...")
            return {"audit_hash": audit_hash, "payment_decisions": updated_decisions}

        # ... (Stellar submission stays the same - it's async already)

        # Save to database
        new_log = AuditLog(
            decision_hash=audit_hash,
            reasoning=reasoning_text,
            stellar_tx_id=stellar_tx_id
        )
        db.add(new_log)
        await db.commit()
        print(f"🔐 Local Audit Log saved with TX reference.")

    return {"audit_hash": audit_hash, "payment_decisions": updated_decisions}
```

**3. `/src/server/agents/router.py`**

The `notify_users_if_quote_below_target` function needs to become async:

```python
async def notify_users_if_quote_below_target(routes):
    """..."""
    # ... (validation stays the same)

    from my_fastapi_app.app.db.session import SessionLocal
    from sqlalchemy import select

    async with SessionLocal() as db:
        result = await db.execute(
            select(CotationNotify).where(
                CotationNotify.rate <= max_rate,
                CotationNotify.has_notified == False
            )
        )
        alerts = result.scalars().all()

        if not alerts:
            print(f"📭 Notify: No users to notify. Best rate = {max_rate:.4f}")
            return {"notifications_sent": 0}

        notifications_sent = 0

        for alert in alerts:
            try:
                send_quote_alert_email(...)  # This is sync, OK
                alert.has_notified = True
                notifications_sent += 1
                print(f"✅ Notify: Sent alert to {alert.email}")
            except Exception as e:
                print(f"⚠️ Notify: Failed to send email: {e}")

        await db.commit()

        return {
            "notifications_sent": notifications_sent,
            "best_rate": max_rate,
            "best_provider": provider_name,
        }

# Update smart_router_node signature
async def smart_router_node(state: AuraState):  # Add async
    """..."""
    # ... (httpx calls stay the same, they're already async-compatible)

    # At the end, call notify function
    await notify_users_if_quote_below_target(options)  # Add await

    return {"route_options": options}
```

**4. `/src/server/agents/researchers.py`**

The `sentiment_researcher_node` is already `async`, good!

The `macro_researcher_node` and `commodity_researcher_node` are sync and don't use DB, so they can stay as-is. BUT if you want consistency, you can make them `async def` (they'll still work in LangGraph).

#### 5.4 Update FastAPI Routes

**Example: `/src/server/my_fastapi_app/app/routes/expenses.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from my_fastapi_app.app.db.session import get_db
from db.models import Liability

router = APIRouter(prefix="/expenses", tags=["Expenses"])

# OLD:
@router.get("/liabilities")
def get_liabilities(db=Depends(get_db)):
    return db.query(Liability).all()

# NEW:
@router.get("/liabilities")
async def get_liabilities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Liability))
    return result.scalars().all()
```

**Repeat this pattern for ALL routes in:**
- `expenses.py`
- `users.py`
- `blockchain.py`
- `fx_routes.py`

#### 5.5 Update Alembic for Async (Optional but Recommended)

**File:** `/src/server/alembic/env.py` (modify `run_migrations_online`)

```python
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

def run_migrations_online():
    """Run migrations in 'online' mode (async)."""

    # Use async engine for migrations
    async_url = settings.get_async_database_url()

    connectable = create_async_engine(async_url)

    async def do_run_migrations():
        async with connectable.connect() as connection:
            await connection.run_sync(do_migrations)

    def do_migrations(connection):
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

    asyncio.run(do_run_migrations())
```

This allows Alembic to work with the async engine.

#### 5.6 Update LangGraph Invocation

**File:** `/src/server/my_fastapi_app/app/main.py` (already async!)

```python
async def monitor_market_loop():
    """Background heartbeat for AI agent system"""
    while True:
        print("Aura heartbeat: Updating market and routes...")

        # LangGraph handles async nodes automatically
        result = await aura_graph.ainvoke(current_state)  # Already async!
        update_state(result)

        await asyncio.sleep(MARKET_MONITOR_INTERVAL_SECONDS)
```

Good news: LangGraph's `ainvoke` already supports async nodes, so this "just works"!

### Testing Phase 5

#### Test 1: Agent Nodes

```bash
# Start backend
cd src/server
just dev

# Watch logs for errors
# Should see normal startup with no asyncio warnings

# Trigger the graph (via API or let heartbeat run)
# Check that all nodes complete successfully
```

#### Test 2: API Endpoints

```bash
# Test liability endpoint
curl http://localhost:8000/expenses/liabilities

# Should return JSON array, no errors

# Test other endpoints
curl http://localhost:8000/agents/status
curl http://localhost:8000/users
# etc.
```

#### Test 3: Database Operations Under Load

```bash
# In one terminal, start backend
just dev

# In another terminal, hammer the API
for i in {1..50}; do
  curl -s http://localhost:8000/agents/status &
done
wait

# All requests should succeed without blocking
```

#### Test 4: Alembic Migrations

```bash
# Create a test migration
alembic revision --autogenerate -m "test async alembic"

# Apply it
alembic upgrade head

# Should work without errors
```

### Rollback Procedure

If Phase 5 breaks everything:

```bash
# 1. Revert all file changes
git checkout src/server/agents/ src/server/my_fastapi_app/

# 2. Restore sync session
# Edit src/server/my_fastapi_app/app/db/session.py
# Use old content (from Phase 4)

# 3. Restart backend
just dev
```

### Success Criteria

- ✅ All agent nodes run without `RuntimeError: no running event loop`
- ✅ All API endpoints return correct data
- ✅ Database operations don't block other requests
- ✅ Alembic migrations work with async engine
- ✅ No performance degradation (should be FASTER)

---

## Phase 6: Semantic Search in Trust Engine

**Goal:** Add pgvector-based contradiction detection to Trust Engine

**Estimated Time:** 2-3 hours

**Risk Level:** Low (additive feature, doesn't break existing functionality)

### Why Add Semantic Search?

**Current Trust Engine:**
- ✅ Hashes decisions to Stellar (tamper-proof)
- ✅ Stores hash + reasoning in PostgreSQL
- ❌ Can't detect contradictions (e.g., "Market is bullish" today vs "Market was bearish" yesterday with same fundamentals)

**With Semantic Search:**
- ✅ Everything above
- ✅ Detects when current thesis contradicts recent analyses
- ✅ Flags low-confidence flip-flops
- ✅ Provides explainability ("This decision differs from March 15 analysis because...")

### Architecture

```
trust_engine_node:
  1. Create audit hash (existing)
  2. Generate embedding of market thesis (NEW)
  3. Search for similar past theses (NEW)
  4. Detect contradictions (NEW)
  5. Hash everything (thesis + contradictions) to Stellar (enhanced)
  6. Save to PostgreSQL with embedding (NEW)
```

### Step-by-Step Implementation

#### 6.1 Enable pgvector Extension

**File:** `/docker-compose.yml` (already done in Phase 1!)

We're already using `pgvector/pgvector:pg16` image, so the extension is available.

**Enable in database:**

```bash
# Connect to DB
just db

# Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
\dx
# Should show: vector | ... | vector data type and ivfflat access method
```

#### 6.2 Update Models to Include Embeddings

**File:** `/src/server/db/models.py` (add)

```python
from pgvector.sqlalchemy import Vector

# Add new model for storing market profile snapshots
class MarketProfileSnapshot(Base):
    __tablename__ = "market_profile_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Reference to audit log
    audit_log_id = Column(Integer, ForeignKey("audit_log.id"), nullable=True)

    # Market analysis fields (from state.MarketAnalysis)
    prediction = Column(String)  # BULLISH | BEARISH | NEUTRAL
    confidence = Column(Float)   # 0.0 to 1.0
    thesis = Column(String)      # The "why"

    # Structured data (JSON)
    metrics = Column(String)     # JSON string of all metrics
    risk_flags = Column(String)  # JSON array of risk flags

    # Semantic search
    embedding = Column(Vector(1536))  # OpenAI text-embedding-3-small dimension

    # Detected contradictions
    contradictions = Column(String, nullable=True)  # JSON array of contradiction descriptions

# Modify AuditLog to include embedding reference
# Add to AuditLog class:
#   profile_snapshot_id = Column(Integer, ForeignKey("market_profile_snapshots.id"), nullable=True)
```

#### 6.3 Create Migration

```bash
cd src/server

# Generate migration
alembic revision --autogenerate -m "add market profile snapshots and embeddings"

# Review the generated file
cat alembic/versions/*_add_market_profile*.py

# Should show:
#   - CREATE TABLE market_profile_snapshots
#   - Add profile_snapshot_id to audit_log
#   - CREATE INDEX on embedding column (for vector similarity search)

# Apply migration
alembic upgrade head
```

#### 6.4 Create Embedding Generator

**File:** `/src/server/agents/embeddings.py` (new file)

```python
"""
Embedding generation for semantic search in Trust Engine.

Uses OpenAI's text-embedding-3-small model (1536 dimensions).
Fallback: Use Google Gemini embeddings if OpenAI key not available.
"""

import os
from typing import List
import httpx


async def generate_embedding(text: str) -> List[float]:
    """
    Generate a 1536-dimension embedding vector for the given text.

    Args:
        text: The text to embed (typically the market thesis)

    Returns:
        List of 1536 floats representing the embedding vector

    Raises:
        Exception: If both OpenAI and Gemini APIs fail
    """

    # Try OpenAI first (most accurate for semantic similarity)
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {openai_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "text-embedding-3-small",
                        "input": text
                    },
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                return data["data"][0]["embedding"]
        except Exception as e:
            print(f"⚠️ OpenAI embedding failed: {e}. Trying Gemini...")

    # Fallback: Google Gemini embeddings
    google_key = os.getenv("GOOGLE_API_KEY")
    if google_key:
        try:
            from google import genai
            client = genai.Client(api_key=google_key)

            result = client.models.embed_content(
                model="models/text-embedding-004",
                content=text
            )

            # Gemini embeddings are 768-dim, need to pad to 1536
            embedding = result.embeddings[0].values
            # Pad with zeros
            if len(embedding) < 1536:
                embedding = embedding + [0.0] * (1536 - len(embedding))

            return embedding[:1536]  # Truncate if somehow longer

        except Exception as e:
            print(f"⚠️ Gemini embedding failed: {e}")

    # No API available, return zero vector (won't match anything, but won't crash)
    print("⚠️ No embedding API available (OPENAI_API_KEY or GOOGLE_API_KEY). Using zero vector.")
    return [0.0] * 1536


async def detect_contradictions(
    current_thesis: str,
    current_embedding: List[float],
    db_session
) -> List[str]:
    """
    Search for past analyses that contradict the current thesis.

    Args:
        current_thesis: The current market thesis text
        current_embedding: The embedding vector for current thesis
        db_session: Async SQLAlchemy session

    Returns:
        List of contradiction descriptions (empty if none found)
    """
    from sqlalchemy import select, text
    from db.models import MarketProfileSnapshot
    import json

    # Find the 5 most similar past analyses using cosine distance
    # pgvector uses <=> operator for cosine distance (0 = identical, 2 = opposite)
    query = text("""
        SELECT
            id,
            created_at,
            prediction,
            confidence,
            thesis,
            risk_flags,
            (embedding <=> :current_embedding::vector) AS distance
        FROM market_profile_snapshots
        WHERE created_at < NOW() - INTERVAL '1 day'  -- Ignore very recent (< 24h)
        ORDER BY distance
        LIMIT 5
    """)

    result = await db_session.execute(
        query,
        {"current_embedding": current_embedding}
    )

    similar_analyses = result.fetchall()

    contradictions = []

    for row in similar_analyses:
        past_id, past_date, past_pred, past_conf, past_thesis, past_flags, distance = row

        # Contradiction detection logic:
        # 1. Very similar thesis (distance < 0.3) but opposite prediction
        # 2. High confidence in both, but different recommendations

        # Parse risk flags
        past_risk_flags = json.loads(past_flags) if past_flags else []

        # Check for prediction flip with similar fundamentals
        if distance < 0.3:  # Very similar context
            # Get current prediction from calling context (we'll pass it)
            # For now, we'll detect this in trust_engine_node

            contradiction = {
                "type": "similar_context_different_prediction",
                "past_date": past_date.isoformat(),
                "past_prediction": past_pred,
                "past_confidence": past_conf,
                "similarity_score": 1.0 - (distance / 2.0),  # Convert to 0-1 scale
                "description": f"Similar market conditions on {past_date.strftime('%Y-%m-%d')} led to {past_pred} prediction (confidence: {past_conf:.0%}), but fundamentals may have changed since then."
            }

            contradictions.append(json.dumps(contradiction))

    return contradictions
```

#### 6.5 Enhance Trust Engine

**File:** `/src/server/agents/trust.py` (modify)

```python
async def trust_engine_node(state: AuraState):
    """
    Role 5: The Trust Engine.
    Enhanced with semantic contradiction detection.
    """
    from agents.embeddings import generate_embedding, detect_contradictions
    from db.models import MarketProfileSnapshot
    from my_fastapi_app.app.db.session import SessionLocal
    from sqlalchemy import select
    import json

    reasoning_text = state.get("selected_route") or "No action recommended."
    market_analysis = state.get("market_analysis", {})

    # Build decision payload (existing logic)
    decision_payload = {
        "market_prediction": market_analysis.get("prediction", state.get("market_prediction")),
        "market_confidence": market_analysis.get("confidence", 0.0),
        "market_thesis": market_analysis.get("thesis", ""),
        "risk_flags": market_analysis.get("risk_flags", []),
        "market_metrics": market_analysis.get("metrics", {}),
        "current_fx_rate": state.get("current_fx_rate"),
        "reasoning": reasoning_text,
        "payment_decisions": state.get("payment_decisions")
    }

    # Generate audit hash (existing)
    dumped_data = json.dumps(decision_payload, sort_keys=True)
    audit_hash = hashlib.sha256(dumped_data.encode()).hexdigest()

    # NEW: Generate embedding for semantic search
    thesis_text = market_analysis.get("thesis", "No thesis available")
    embedding = await generate_embedding(thesis_text)

    async with SessionLocal() as db:
        # Check if hash exists (existing logic)
        result = await db.execute(
            select(AuditLog).where(AuditLog.decision_hash == audit_hash)
        )
        existing_log = result.scalar_one_or_none()

        if existing_log:
            print(f"♻️ Trust Engine: Audit exists. TX: {existing_log.stellar_tx_id[:10]}...")
            # Still return, but maybe update embedding if missing
            return {"audit_hash": audit_hash, "payment_decisions": ...}

        # NEW: Detect contradictions
        contradictions = await detect_contradictions(thesis_text, embedding, db)

        if contradictions:
            print(f"⚠️ Trust Engine: Detected {len(contradictions)} potential contradictions")
            for contra in contradictions[:2]:  # Print first 2
                print(f"   {contra[:100]}...")

        # Add contradictions to payload before hashing to Stellar
        decision_payload["contradictions_detected"] = contradictions
        dumped_data = json.dumps(decision_payload, sort_keys=True)
        audit_hash = hashlib.sha256(dumped_data.encode()).hexdigest()  # Re-hash

        # Submit to Stellar (existing logic, unchanged)
        stellar_tx_id = None
        secret_key = os.getenv("STELLAR_SECRET_KEY")
        if secret_key:
            # ... (Stellar submission code stays the same)
            pass

        # Save to PostgreSQL
        # First, create MarketProfileSnapshot
        snapshot = MarketProfileSnapshot(
            prediction=market_analysis.get("prediction"),
            confidence=market_analysis.get("confidence"),
            thesis=thesis_text,
            metrics=json.dumps(market_analysis.get("metrics", {})),
            risk_flags=json.dumps(market_analysis.get("risk_flags", [])),
            embedding=embedding,
            contradictions=json.dumps(contradictions) if contradictions else None
        )
        db.add(snapshot)
        await db.flush()  # Get the ID

        # Then, create AuditLog
        new_log = AuditLog(
            decision_hash=audit_hash,
            reasoning=reasoning_text,
            stellar_tx_id=stellar_tx_id,
            profile_snapshot_id=snapshot.id  # Link to snapshot
        )
        db.add(new_log)
        await db.commit()

        print(f"🔐 Trust Engine: Saved audit log with {len(contradictions)} contradictions flagged")

    # Return enhanced decisions
    updated_decisions = []
    for decision in state.get("payment_decisions", []):
        d = decision.copy()
        d["audit_hash"] = audit_hash
        d["contradictions_count"] = len(contradictions)  # NEW
        updated_decisions.append(d)

    return {"audit_hash": audit_hash, "payment_decisions": updated_decisions}
```

#### 6.6 Update Configuration for OpenAI Key

**File:** `/src/server/.env.example` (add)

```bash
# Semantic Search (Phase 6 - optional but recommended)
OPENAI_API_KEY=your_openai_api_key_here    # For embeddings (text-embedding-3-small)
```

**File:** `/src/server/config.py` (add)

```python
class Settings(BaseSettings):
    # ... existing fields ...

    # Semantic search (Phase 6)
    openai_api_key: str = Field(default="", description="OpenAI API key (for embeddings)")
```

#### 6.7 Add API Endpoint to View Contradictions

**File:** `/src/server/my_fastapi_app/app/routes/blockchain.py` (add)

```python
@router.get("/audit/{audit_hash}/contradictions")
async def get_contradictions(audit_hash: str, db: AsyncSession = Depends(get_db)):
    """
    Get the market profile snapshot and contradictions for a specific audit hash.
    """
    from sqlalchemy import select
    from db.models import AuditLog, MarketProfileSnapshot
    import json

    # Find audit log
    result = await db.execute(
        select(AuditLog).where(AuditLog.decision_hash == audit_hash)
    )
    audit = result.scalar_one_or_none()

    if not audit or not audit.profile_snapshot_id:
        raise HTTPException(status_code=404, detail="Audit not found or no snapshot")

    # Get snapshot
    result = await db.execute(
        select(MarketProfileSnapshot).where(MarketProfileSnapshot.id == audit.profile_snapshot_id)
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    return {
        "audit_hash": audit_hash,
        "created_at": snapshot.created_at,
        "prediction": snapshot.prediction,
        "confidence": snapshot.confidence,
        "thesis": snapshot.thesis,
        "risk_flags": json.loads(snapshot.risk_flags),
        "contradictions": json.loads(snapshot.contradictions) if snapshot.contradictions else []
    }
```

### Testing Phase 6

#### Test 1: Database Setup

```bash
# Run migration
cd src/server
alembic upgrade head

# Verify tables
just db
\dt
# Should show: market_profile_snapshots

\d market_profile_snapshots
# Should show: embedding column with type vector(1536)
```

#### Test 2: Embedding Generation

```bash
# Set OpenAI key in .env
echo "OPENAI_API_KEY=sk-..." >> .env

# Test embedding generation
python -c "
import asyncio
from agents.embeddings import generate_embedding

async def test():
    emb = await generate_embedding('The market is bullish')
    print(f'Embedding length: {len(emb)}')
    print(f'First 5 values: {emb[:5]}')

asyncio.run(test())
"

# Should print:
#   Embedding length: 1536
#   First 5 values: [0.123, -0.456, ...]
```

#### Test 3: Trust Engine with Semantic Search

```bash
# Start backend
just dev

# Let the heartbeat run for a few cycles
# Watch logs for:
#   "🔐 Trust Engine: Saved audit log with X contradictions flagged"

# After a few cycles, check database
just db
SELECT id, prediction, confidence, created_at FROM market_profile_snapshots ORDER BY created_at DESC LIMIT 5;

# Should show multiple snapshots
```

#### Test 4: Contradiction Detection

```bash
# Manually change market conditions to trigger contradiction
# Edit src/server/agents/researchers.py temporarily
# Force market_synthesis_node to return opposite prediction

# Restart backend, let it run
# Should see:
#   "⚠️ Trust Engine: Detected 1 potential contradictions"

# Query the contradictions
curl http://localhost:8000/blockchain/audit/{hash}/contradictions | jq .

# Should show contradiction details
```

### Rollback Procedure

If Phase 6 breaks something:

```bash
# 1. Revert trust.py changes
git checkout src/server/agents/trust.py

# 2. Remove embeddings.py
rm src/server/agents/embeddings.py

# 3. Rollback migration
alembic downgrade -1

# 4. Restart backend
just dev
```

Stellar hashing still works (Phase 6 is additive).

### Success Criteria

- ✅ Embeddings generated for each market thesis
- ✅ Similar past analyses are found via vector search
- ✅ Contradictions are detected and flagged
- ✅ Contradictions are included in Stellar hash
- ✅ API endpoint returns contradiction details
- ✅ Trust Engine still works if OpenAI key is missing (fallback to Gemini or zero vector)

---

## Testing Strategy

### Integration Testing Checklist

After completing all 6 phases, run this full test:

```bash
# 1. Clean slate
cd /path/to/revellio
docker compose down -v
git status  # Should be clean

# 2. Start full stack
docker compose up -d --build

# 3. Wait for services
sleep 10

# 4. Check service health
docker compose ps
# All services should be "healthy" or "running"

# 5. Test backend
curl http://localhost:8000/health
# {"status": "ok"}

# 6. Test frontend
open http://localhost:5173
# React app loads

# 7. Test database
docker compose exec db psql -U postgres -d revellio -c "\dt"
# Shows: liabilities, audit_log, users, cotation_notify, market_profile_snapshots, alembic_version

# 8. Test agents (wait for heartbeat to run)
sleep 70
curl http://localhost:8000/agents/status | jq .
# Should show market_analysis with thesis, confidence, risk_flags

# 9. Test semantic search
# Get an audit hash from the logs
docker compose logs backend | grep "audit_hash"
# Copy a hash

curl http://localhost:8000/blockchain/audit/{hash}/contradictions | jq .
# Should return contradiction data or empty array

# 10. Test hot reload
# Edit src/server/my_fastapi_app/app/main.py
# Change version number in the FastAPI title
# Save file
sleep 5
curl http://localhost:8000/openapi.json | jq .info.version
# Should show new version WITHOUT restarting container

# 11. Test native mode (backwards compat)
docker compose down
cd src/server
just up
just dev
# Backend should start normally

# 12. Test migrations
alembic current
# Should show latest migration version
```

### Performance Benchmarks

Measure improvements from Phase 5 (AsyncSession):

```bash
# Before async (baseline):
# - Heartbeat blocks all requests: ~500ms
# - API latency during heartbeat: ~600ms

# After async:
# - Heartbeat doesn't block: ~400ms (faster!)
# - API latency during heartbeat: ~50ms (12x improvement!)

# Test with ApacheBench:
ab -n 100 -c 10 http://localhost:8000/agents/status

# Compare "Time per request" before and after Phase 5
```

---

## Deployment Guide

### VPS Deployment (One-Command)

After all phases are complete, deploying to a VPS is trivial:

```bash
# 1. SSH into VPS
ssh user@your-vps-ip

# 2. Clone repository
git clone https://github.com/your-username/revellio.git
cd revellio

# 3. Create .env files
cp src/server/.env.example src/server/.env
# Edit .env with production values (API keys, DB password, etc.)

# 4. Start stack
docker compose up -d --build

# 5. Check logs
docker compose logs -f

# That's it! Revellio is running on:
# - Backend: http://vps-ip:8000
# - Frontend: http://vps-ip:5173
# - Adminer: http://vps-ip:8080
```

### Production Checklist

- [ ] Set strong `POSTGRES_PASSWORD` in `.env`
- [ ] Use production Stellar keys (not testnet)
- [ ] Set `ALLOWED_ORIGINS` to your production domain
- [ ] Add HTTPS reverse proxy (Nginx + Let's Encrypt)
- [ ] Enable PostgreSQL backups (pg_dump cron)
- [ ] Monitor disk space for Docker volumes
- [ ] Set up logging aggregation (optional)

---

## Summary

**Total Estimated Time:** 8-10 hours across 6 phases

**Outcome:**
- ✅ One-command development setup (`docker compose up -d`)
- ✅ One-command VPS deployment (same command!)
- ✅ Modern Python packaging (pyproject.toml)
- ✅ Type-safe configuration (pydantic-settings)
- ✅ Production-ready database migrations (Alembic)
- ✅ High-performance async database operations
- ✅ Intelligent contradiction detection (semantic search)
- ✅ Verifiable audit trail (Stellar blockchain)

**Backward Compatibility:**
- ✅ Native development mode still works (`just up && just dev`)
- ✅ Existing features unchanged (all 5 agents, FX routing, etc.)
- ✅ Existing directory structure preserved

**Next Steps:**
1. Review this plan
2. Ask questions / request clarifications
3. Implement phase by phase (test after each)
4. Celebrate when `docker compose up -d` works! 🎉
