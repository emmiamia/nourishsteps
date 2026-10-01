import json
import re
from datetime import date
from pathlib import Path

CORPUS = Path(__file__).resolve().parents[1] / 'knowledge' / 'support.json'

def retrieve(topic, today=None, records=None):
    today = today or date.today()
    records = records if records is not None else json.loads(CORPUS.read_text())
    words = set(re.findall(r'[a-z]+', topic.lower()))
    ranked = []
    for row in records:
        # Source-checked for demo is explicitly not clinical approval.
        if row['status'] != 'source_checked_demo' or date.fromisoformat(row['review_due_at']) < today:
            continue
        score = len(words & set(row['tags']))
        if score:
            ranked.append((score, row['id'], row))
    return [row for _, _, row in sorted(ranked, key=lambda x: (-x[0], x[1]))[:3]]
