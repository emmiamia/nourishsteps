"""Separate demo storage: never fall back to the existing nourish.db."""
import os
from pathlib import Path
from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DEFAULT_PATH = Path(__file__).resolve().parents[1] / 'agent-demo.db'

@lru_cache(maxsize=4)
def factory(url=None):
    url = url or os.getenv('AGENT_DATABASE_URL', f'sqlite:///{DEFAULT_PATH}')
    if not url.startswith('sqlite:///'):
        raise RuntimeError('V1 supports a separate local SQLite demo database only.')
    from models import engine as journal_engine
    if Path(url.removeprefix('sqlite:///')).resolve() == Path(str(journal_engine.url).removeprefix('sqlite:///')).resolve():
        raise RuntimeError('Agent demo storage must be separate from the journal database.')
    engine = create_engine(url, future=True, connect_args={'timeout': 5})
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)
