from models import SessionLocal, Resource, CheckIn
from datetime import date, timedelta

session = SessionLocal()

# Reset tables (simple demo way)
session.query(Resource).delete()
session.query(CheckIn).delete()

resources = [
    Resource(title="988 Suicide & Crisis Lifeline", url="https://988lifeline.org/", type="crisis", tags="crisis,hotline"),
    Resource(title="NEDA Helpline", url="https://www.nationaleatingdisorders.org/", type="crisis", tags="ed,hotline"),
    Resource(title="Recovery Record (app)", url="https://recoveryrecord.com/", type="info", tags="tracking,app"),
    Resource(title="F.E.A.S.T. Families", url="https://www.feast-ed.org/", type="community", tags="family,community"),
]
session.add_all(resources)

# Seed 7 days of sample check-ins
for i in range(7):
    d = date.today() - timedelta(days=(6 - i))
    session.add(CheckIn(date=d, mood=3 + i % 2, urge=i % 3, meal_status=["skipped", "partial", "completed"][i % 3]))

session.commit()
session.close()
print("Seeded.")
