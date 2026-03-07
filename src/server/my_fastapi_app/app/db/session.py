import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Uses the credentials from your docker-compose
DATABASE_URL = "postgresql://postgres:example@127.0.0.1:5432/postgres"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
