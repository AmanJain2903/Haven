"""
Tests for database connection and session management.
"""
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session


class TestDatabase:
    """Test suite for app.core.database"""

    def test_get_db_yields_session(self):
        """Test that get_db yields a database session"""
        from app.core.database import get_db
        
        # get_db is a generator, so we need to iterate
        db_gen = get_db()
        db = next(db_gen)
        
        assert db is not None
        assert isinstance(db, Session)
        
        # Clean up
        try:
            next(db_gen)
        except StopIteration:
            pass

    def test_get_db_closes_session(self):
        """Test that get_db closes session after use"""
        from app.core.database import get_db
        
        db_gen = get_db()
        db = next(db_gen)
        close_spy = MagicMock()
        db.close = close_spy
        
        # Exit the context (simulate finally block)
        try:
            next(db_gen)
        except StopIteration:
            pass
        
        # Session should be closed
        close_spy.assert_called_once()

    def test_engine_creation(self):
        """Test that engine is created"""
        from app.core.database import engine
        
        # Engine is created at module import time, so we just verify it exists
        assert engine is not None

    def test_session_local_creation(self):
        """Test that SessionLocal is created"""
        from app.core.database import SessionLocal
        
        assert SessionLocal is not None
        # SessionLocal should be a sessionmaker instance
        assert hasattr(SessionLocal, '__call__')
