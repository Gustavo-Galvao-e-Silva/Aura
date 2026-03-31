from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from my_fastapi_app.app.settings import settings

# Convert database URL to async driver (postgresql -> postgresql+asyncpg)
database_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(database_url, echo=False)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Async dependency injection for FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
