"""Versioned, additive SQLite migration. Run explicitly, never seed real data."""
import argparse
import sqlite3
from datetime import datetime
from pathlib import Path
from sqlalchemy import inspect, text
from models import Base
from agent import models  # register tables
from agent.storage import factory

GOAL_COLUMNS = {
    'owner_scope': 'VARCHAR(64)', 'updated_at': 'DATETIME',
    'follow_up_after': 'DATE', 'last_reviewed_at': 'DATETIME',
    'source': 'VARCHAR(32)',
}
NEW_TABLES = ['agent_actions', 'agent_sessions', 'reflection_entries']

def upgrade(engine):
    with engine.begin() as conn:
        if 'goals' in inspect(conn).get_table_names():
            existing = {c['name'] for c in inspect(conn).get_columns('goals')}
            for name, kind in GOAL_COLUMNS.items():
                if name not in existing:
                    conn.execute(text(f'ALTER TABLE goals ADD COLUMN {name} {kind}'))
        Base.metadata.create_all(conn)
        conn.execute(text('CREATE TABLE IF NOT EXISTS agent_schema_versions (version INTEGER PRIMARY KEY)'))
        conn.execute(text('INSERT OR IGNORE INTO agent_schema_versions VALUES (1)'))

def downgrade(engine):
    """Refuse destructive rollback when user-confirmed or session data exists."""
    with engine.begin() as conn:
        for table in NEW_TABLES:
            if table in inspect(conn).get_table_names() and conn.execute(text(f'SELECT COUNT(*) FROM {table}')).scalar():
                raise ValueError('Rollback refused: agent data exists. Export it and restore a backup instead.')
        if 'goals' in inspect(conn).get_table_names():
            if conn.execute(text("SELECT COUNT(*) FROM goals WHERE owner_scope IS NOT NULL")).scalar():
                raise ValueError('Rollback refused: agent goals exist.')
        for table in NEW_TABLES:
            conn.execute(text(f'DROP TABLE IF EXISTS {table}'))
        if 'goals' in inspect(conn).get_table_names():
            for name in GOAL_COLUMNS:
                conn.execute(text(f'ALTER TABLE goals DROP COLUMN {name}'))
        conn.execute(text('DROP TABLE IF EXISTS agent_schema_versions'))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('direction', choices=['upgrade', 'downgrade'], nargs='?', default='upgrade')
    args = parser.parse_args()
    engine = factory().kw['bind']
    path = Path(engine.url.database)
    if path.exists():
        backup = path.with_name(path.name + '.' + datetime.utcnow().strftime('%Y%m%d%H%M%S%f') + '.bak')
        with sqlite3.connect(path) as src, sqlite3.connect(backup) as dst:
            src.backup(dst)
        print(f'Backup: {backup}')
    (upgrade if args.direction == 'upgrade' else downgrade)(engine)
    print(f'Agent schema: {args.direction} complete')

if __name__ == '__main__':
    main()
