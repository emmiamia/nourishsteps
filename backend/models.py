from datetime import datetime, date
from sqlalchemy import create_engine, Column, Integer, String, Date, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import func

engine = create_engine("sqlite:///nourish.db", echo=False, future=True)
Base = declarative_base()
SessionLocal = sessionmaker(bind=engine, autoflush=False, future=True)

class CheckIn(Base):
    __tablename__ = "checkins"
    id = Column(Integer, primary_key=True)
    date = Column(Date, default=date.today)
    mood = Column(Integer)
    urge = Column(Integer)
    meal_status = Column(String(16))
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True)
    title = Column(String(200))
    status = Column(String(16), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

class Meal(Base):
    __tablename__ = "meals"
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)                   # 用餐日期
    meal_type = Column(String(16), nullable=False)        # breakfast | lunch | dinner | snack
    status = Column(String(16), nullable=False, default="planned")  # planned | completed | partial | skipped
    duration_sec = Column(Integer, nullable=True)         # （可选）用餐时长（秒）
    note = Column(Text, nullable=True)                    # 备注
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    
class Resource(Base):
    __tablename__ = "resources"
    id = Column(Integer, primary_key=True)
    title = Column(String(200))
    url = Column(String(500))
    type = Column(String(24))
    tags = Column(String(200))

Base.metadata.create_all(engine)
