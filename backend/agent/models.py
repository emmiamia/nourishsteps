from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, Date, JSON
from models import Base

class ReflectionEntry(Base):
    __tablename__ = 'reflection_entries'
    id = Column(Integer, primary_key=True)
    owner_scope = Column(String(64), nullable=False, index=True)
    date = Column(Date, nullable=False)
    original_text = Column(Text, nullable=False)
    meal_type = Column(String(16), nullable=True)
    mood_label = Column(String(80), nullable=True)
    context_text = Column(Text, nullable=True)
    confirmed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    provenance = Column(String(32), default='user_confirmed', nullable=False)

class AgentSession(Base):
    __tablename__ = 'agent_sessions'
    id = Column(String(64), primary_key=True)
    owner_scope = Column(String(64), nullable=False, index=True)
    consent = Column(JSON, nullable=False)
    state = Column(String(32), default='observing', nullable=False)
    transcript = Column(JSON, default=list, nullable=False)
    evidence = Column(JSON, default=dict, nullable=False)
    sources = Column(JSON, default=list, nullable=False)
    hypothesis = Column(JSON, nullable=True)
    agent_version = Column(String(16), default='v1', nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    turn_count = Column(Integer, default=0, nullable=False)

class AgentAction(Base):
    __tablename__ = 'agent_actions'
    id = Column(String(64), primary_key=True)
    session_id = Column(String(64), nullable=False, index=True)
    owner_scope = Column(String(64), nullable=False, index=True)
    kind = Column(String(32), nullable=False)
    payload = Column(JSON, nullable=False)
    payload_hash = Column(String(64), nullable=False)
    status = Column(String(16), default='pending', nullable=False)
    expires_at = Column(DateTime, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    result = Column(JSON, nullable=True)
