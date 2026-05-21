from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Create engine with pool settings suitable for standard RDBMS
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Ensures connections are alive before using
    pool_size=10,
    max_overflow=20
)

# Create a local session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Declarative base class for models
Base = declarative_base()

# FastAPI dependency provider for requests
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
