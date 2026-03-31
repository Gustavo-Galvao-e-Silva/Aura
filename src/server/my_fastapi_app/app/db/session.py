from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from my_fastapi_app.app.settings import settings

# Database URL is constructed from settings (handles DATABASE_URL or individual components)
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
