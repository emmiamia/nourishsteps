"""Create synthetic examples in agent-demo.db, without changing nourish.db."""
from datetime import date, timedelta
from models import Meal, CheckIn
from agent.storage import factory
from agent.migrate import upgrade

def seed(db):
    if db.query(Meal).count() or db.query(CheckIn).count():
        return False
    for i in [1,3,5]:
        d = date.today()-timedelta(days=i)
        db.add(Meal(date=d,meal_type='lunch',status='partial',note='Synthetic example: rushed between classes; I felt stressed.'))
        db.add(CheckIn(date=d,mood=2,urge=1,meal_status='partial',note='Synthetic example: classes felt busy today.'))
    db.add(Meal(date=date.today()-timedelta(days=2),meal_type='lunch',status='completed',note='Synthetic example: classes today, but lunch felt unhurried.'))
    db.commit()
    return True

def main():
    db_factory = factory()
    upgrade(db_factory.kw['bind'])
    with db_factory() as db:
        print('Synthetic examples created.' if seed(db) else 'Demo data already exists; preserved it.')
    print('Local demo storage ready. No existing journal data was copied.')

if __name__ == '__main__':
    main()
