from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Normalize DATABASE_URL to always use psycopg2 driver regardless of what Render sets
_db_url = settings.DATABASE_URL
_db_url = _db_url.replace('postgresql+psycopg://', 'postgresql+psycopg2://')
_db_url = _db_url.replace('postgres://', 'postgresql+psycopg2://')
_db_url = _db_url.replace('postgresql://', 'postgresql+psycopg2://')

engine = create_engine(
    _db_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 5},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
