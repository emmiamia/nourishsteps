# Deployment Guide

## Docker Deployment

### Prerequisites
- Docker and Docker Compose installed

### Quick Start

1. **Build and run with Docker Compose:**
```bash
docker-compose up -d --build
```

2. **Access the application:**
- Frontend: http://localhost
- API: http://localhost/api

### Manual Docker Build

1. **Build the image:**
```bash
docker build -t nourishsteps .
```

2. **Run the container:**
```bash
docker run -p 80:80 -v $(pwd)/backend/nourish.db:/app/backend/nourish.db nourishsteps
```

## Production Deployment

### Environment Variables

Create a `.env` file in the backend directory:
```env
FLASK_ENV=production
DATABASE_URL=sqlite:///nourish.db
```

### Backend Deployment

1. **Set up Python environment:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. **Initialize database:**
```bash
python -c "from models import Base, engine; Base.metadata.create_all(engine)"
python seed.py
```

3. **Run with production server:**
```bash
# Using gunicorn (recommended)
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5001 app:app
```

### Frontend Deployment

1. **Build for production:**
```bash
cd frontend
npm install
npm run build
```

2. **Serve with nginx:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/frontend/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Cloud Deployment Options

### Vercel (Frontend) + Railway (Backend)

1. **Frontend on Vercel:**
   - Connect GitHub repo
   - Set build command: `cd frontend && npm install && npm run build`
   - Set output directory: `frontend/dist`

2. **Backend on Railway:**
   - Connect GitHub repo
   - Set start command: `cd backend && python app.py`
   - Add environment variables

### Heroku

1. **Create Procfile:**
```
web: cd backend && gunicorn -w 4 -b 0.0.0.0:$PORT app:app
```

2. **Deploy:**
```bash
heroku create your-app-name
git push heroku main
```

## Database Backup

```bash
# Backup SQLite database
cp backend/nourish.db backend/nourish.db.backup

# Restore
cp backend/nourish.db.backup backend/nourish.db
```

