"""Isolate legacy tests before importing app/models; never touch nourish.db."""
import os
import tempfile
from pathlib import Path
import pytest

_TEST_ROOT = tempfile.TemporaryDirectory(prefix='nourish-tests-')
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(_TEST_ROOT.name) / 'journal.db')
os.environ['AGENT_DATABASE_URL'] = 'sqlite:///' + str(Path(_TEST_ROOT.name) / 'agent.db')

@pytest.fixture(autouse=True)
def clean_tables():
    from models import Base, engine
    from agent.storage import factory
    from agent.migrate import upgrade
    from agent.routes import BUCKETS
    from app import app
    Base.metadata.create_all(engine)
    agent_engine = factory().kw['bind']
    upgrade(agent_engine)
    BUCKETS.clear()
    app.config['AGENT_TESTING'] = True
    app.config.pop('AGENT_PROVIDER', None)
    yield
    for target in [engine, agent_engine]:
        with target.begin() as connection:
            for table in reversed(Base.metadata.sorted_tables):
                if table.name in __import__('sqlalchemy').inspect(connection).get_table_names():
                    connection.execute(table.delete())
