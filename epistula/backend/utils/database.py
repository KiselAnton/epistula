"""Database configuration and connection management for Epistula.

This module handles:
- Database connection setup
- SQLAlchemy engine and session configuration
- Multi-schema support for university data
- Connection pooling and health checks
"""

import os
from typing import Generator, Optional
from contextlib import contextmanager

from sqlalchemy import create_engine, text, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


# ============================================================================
# Configuration from Environment Variables
# ============================================================================

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "epistula")
DB_USER = os.getenv("DB_USER", "epistula_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# Construct database URL
# Note: Using psycopg (version 3) driver - compatible with SQLAlchemy 2.0+
DATABASE_URL = f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# SQLAlchemy settings
SQLALCHEMY_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
SQLALCHEMY_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
SQLALCHEMY_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
SQLALCHEMY_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))

# ============================================================================
# Engine and Session Configuration
# ============================================================================

# Create SQLAlchemy engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=SQLALCHEMY_POOL_SIZE,
    max_overflow=SQLALCHEMY_MAX_OVERFLOW,
    pool_timeout=SQLALCHEMY_POOL_TIMEOUT,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=SQLALCHEMY_POOL_RECYCLE,
    echo=os.getenv("EPISTULA_ENV", "development") == "development",  # Log SQL in dev
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for SQLAlchemy models
Base = declarative_base()


# ============================================================================
# Schema Management
# ============================================================================

@event.listens_for(Engine, "connect")
def set_search_path(dbapi_conn, connection_record):
    """Set the default search path to include public schema.
    
    This ensures we can access global tables without schema prefix.
    """
    cursor = dbapi_conn.cursor()
    cursor.execute("SET search_path TO public")
    cursor.close()


def set_schema(session: Session, schema_name: str) -> None:
    """Set the search path for a session to access a specific university schema.
    
    Args:
        session: SQLAlchemy session
        schema_name: Name of the schema to access (e.g., 'uni_1')
    
    Example:
        set_schema(session, 'uni_1')
        # Now queries will search uni_1 schema first, then public
    """
    session.execute(text(f"SET search_path TO {schema_name}, public"))


def reset_schema(session: Session) -> None:
    """Reset the search path to default (public only).
    
    Args:
        session: SQLAlchemy session
    """
    session.execute(text("SET search_path TO public"))


@contextmanager
def university_session(
    university_id: int,
    session: Optional[Session] = None
) -> Generator[Session, None, None]:
    """Context manager for accessing a university's schema.
    
    Args:
        university_id: ID of the university
        session: Existing session to use, or None to create a new one
        
    Yields:
        Session configured with the university's schema in search path
        
    Example:
        with university_session(university_id=1) as sess:
            faculties = sess.query(Faculty).all()
    """
    close_session = False
    if session is None:
        session = SessionLocal()
        close_session = True
    
    try:
        # Get schema name from university ID
        result = session.execute(
            text("SELECT schema_name FROM public.universities WHERE id = :id"),
            {"id": university_id}
        )
        row = result.fetchone()
        
        if row is None:
            raise ValueError(f"University with ID {university_id} not found")
        
        schema_name = row[0]
        
        # Set search path to university schema
        set_schema(session, schema_name)
        
        yield session
        
    finally:
        # Reset search path
        reset_schema(session)
        
        if close_session:
            session.close()


# ============================================================================
# Dependency Injection for FastAPI
# ============================================================================

def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session.
    
    Yields:
        Database session that will be automatically closed after request
        
    Example:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================================
# Health Check and Utility Functions
# ============================================================================

def check_database_connection() -> bool:
    """Check if database connection is working.
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


def get_database_version() -> Optional[str]:
    """Get PostgreSQL version.
    
    Returns:
        PostgreSQL version string, or None if connection fails
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            return result.fetchone()[0]
    except Exception as e:
        print(f"Failed to get database version: {e}")
        return None


def list_university_schemas() -> list[str]:
    """List all university schemas in the database.
    
    Returns:
        List of schema names (e.g., ['uni_1', 'uni_2'])
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT schema_name FROM public.universities WHERE is_active = TRUE")
            )
            return [row[0] for row in result.fetchall()]
    except Exception as e:
        print(f"Failed to list schemas: {e}")
        return []


def create_all_tables():
    """Create all tables defined in SQLAlchemy models.
    
    Note: This only creates tables in the public schema.
    University schemas are created via SQL functions.
    """
    Base.metadata.create_all(bind=engine)


def drop_all_tables():
    """Drop all tables defined in SQLAlchemy models.
    
    WARNING: This is destructive! Only use in development.
    """
    Base.metadata.drop_all(bind=engine)


# ============================================================================
# Module Exports
# ============================================================================

__all__ = [
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
    "set_schema",
    "reset_schema",
    "university_session",
    "check_database_connection",
    "get_database_version",
    "list_university_schemas",
    "create_all_tables",
    "drop_all_tables",
    "DATABASE_URL",
]
