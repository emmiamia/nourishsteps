"""
Backend API Tests
Tests for core functionality of the NourishSteps API
"""
import pytest
import json
from datetime import date, timedelta
from app import app
from models import SessionLocal, CheckIn, Meal, Base, engine

@pytest.fixture
def client():
    """Create a test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def db_session():
    """Create a test database session"""
    Base.metadata.create_all(engine)
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def cleanup_db():
    """Clean up test data"""
    yield
    db = SessionLocal()
    try:
        db.query(CheckIn).delete()
        db.query(Meal).delete()
        db.commit()
    finally:
        db.close()

class TestHealth:
    """Test health check endpoint"""
    def test_health(self, client):
        response = client.get('/api/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['ok'] == True

class TestCheckIns:
    """Test check-in endpoints"""
    
    def test_create_checkin(self, client, cleanup_db):
        data = {
            "date": date.today().isoformat(),
            "mood": 4,
            "urge": 2,
            "meal_status": "completed",
            "note": "Feeling good today"
        }
        response = client.post('/api/checkins',
                             data=json.dumps(data),
                             content_type='application/json')
        assert response.status_code == 201
        result = json.loads(response.data)
        assert result['mood'] == 4
        assert result['urge'] == 2
        assert result['meal_status'] == 'completed'
    
    def test_create_checkin_validation(self, client):
        # Test invalid mood
        data = {"mood": 10, "urge": 2}
        response = client.post('/api/checkins',
                             data=json.dumps(data),
                             content_type='application/json')
        assert response.status_code == 400
    
    def test_list_checkins(self, client, cleanup_db):
        # Create a test check-in
        data = {
            "date": date.today().isoformat(),
            "mood": 3,
            "urge": 1,
            "meal_status": "partial"
        }
        client.post('/api/checkins',
                   data=json.dumps(data),
                   content_type='application/json')
        
        # List check-ins
        response = client.get('/api/checkins')
        assert response.status_code == 200
        result = json.loads(response.data)
        assert isinstance(result, list)
        assert len(result) > 0
    
    def test_summary7(self, client, cleanup_db):
        # Create some test check-ins
        for i in range(3):
            data = {
                "date": (date.today() - timedelta(days=i)).isoformat(),
                "mood": 4,
                "urge": 1,
                "meal_status": "completed"
            }
            client.post('/api/checkins',
                       data=json.dumps(data),
                       content_type='application/json')
        
        response = client.get('/api/summary7')
        assert response.status_code == 200
        result = json.loads(response.data)
        assert 'days' in result
        assert 'meals' in result
        assert 'streak' in result
        assert len(result['days']) == 7

class TestMeals:
    """Test meal endpoints"""
    
    def test_create_meal(self, client, cleanup_db):
        data = {
            "date": date.today().isoformat(),
            "meal_type": "breakfast",
            "status": "completed"
        }
        response = client.post('/api/meals',
                             data=json.dumps(data),
                             content_type='application/json')
        assert response.status_code == 201
        result = json.loads(response.data)
        assert result['meal_type'] == 'breakfast'
    
    def test_list_meals(self, client, cleanup_db):
        # Create test meals
        for meal_type in ["breakfast", "lunch", "dinner"]:
            data = {
                "date": date.today().isoformat(),
                "meal_type": meal_type,
                "status": "completed"
            }
            client.post('/api/meals',
                       data=json.dumps(data),
                       content_type='application/json')
        
        response = client.get(f'/api/meals?date={date.today().isoformat()}')
        assert response.status_code == 200
        result = json.loads(response.data)
        assert isinstance(result, list)
        assert len(result) == 3
    
    def test_meals_summary7(self, client, cleanup_db):
        # Create meals for different days
        for i in range(3):
            data = {
                "date": (date.today() - timedelta(days=i)).isoformat(),
                "meal_type": "breakfast",
                "status": "completed"
            }
            client.post('/api/meals',
                       data=json.dumps(data),
                       content_type='application/json')
        
        response = client.get('/api/meals/summary7')
        assert response.status_code == 200
        result = json.loads(response.data)
        assert 'days' in result
        assert 'meals' in result
        assert 'streak' in result

