# Render Deployment - Native Services (Recommended)

This guide shows how to deploy using Render's native Node.js and Python services instead of Docker. This is simpler and easier to manage.

## Architecture

- **Frontend**: Static Site (or Node.js Web Service)
- **Backend**: Python Web Service

## Step 1: Deploy Backend (Python Service)

### Create a Python Web Service

1. In Render dashboard, click "New +" → "Web Service"
2. Connect your repository
3. Fill in:
   - **Name**: `nourishsteps-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `cd backend && pip install -r requirements.txt && python -c "from models import Base, engine; Base.metadata.create_all(engine)"`
   - **Start Command**: `cd backend && gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Root Directory**: Leave blank (or set to `backend` if you prefer)

### Environment Variables

Add these environment variables:
- `PORT`: Render will set this automatically
- `FLASK_ENV`: `production`

### Update CORS for Production

You'll need to update `backend/app.py` to allow your frontend URL. After deploying the frontend, you'll get a URL like `https://nourishsteps.onrender.com`. Update CORS:

```python
# In backend/app.py, update line 10:
CORS(app, resources={r"/api/*": {
    "origins": [
        "http://localhost:5173",
        "http://localhost:5174", 
        "https://nourishsteps.onrender.com",  # Your frontend URL
        "https://*.onrender.com"  # Or allow all Render subdomains
    ]
}})
```

### Install Gunicorn

Add `gunicorn` to `backend/requirements.txt` if not already there:

```bash
echo "gunicorn==21.2.0" >> backend/requirements.txt
```

## Step 2: Deploy Frontend (Static Site)

### Option A: Static Site (Recommended - Free)

1. In Render dashboard, click "New +" → "Static Site"
2. Connect your repository
3. Fill in:
   - **Name**: `nourishsteps`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
   - **Root Directory**: Leave blank

### Option B: Web Service (If you need server-side features)

1. In Render dashboard, click "New +" → "Web Service"
2. Connect your repository
3. Fill in:
   - **Name**: `nourishsteps-frontend`
   - **Environment**: `Node`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: `cd frontend && npm run preview` (or use a static server)
   - **Root Directory**: Leave blank

### Environment Variables for Frontend

Add this environment variable:
- `VITE_API`: `https://nourishsteps-backend.onrender.com` (your backend URL)

**Important**: Update `frontend/src/api.js` to use this:

```javascript
const API = import.meta.env.VITE_API || (import.meta.env.PROD ? "" : "http://localhost:5001");
```

This will use the `VITE_API` env var in production.

## Step 3: Update Frontend API Configuration

The frontend needs to know the backend URL. After deploying the backend, you'll get a URL like `https://nourishsteps-backend.onrender.com`.

### For Static Site:
Set `VITE_API` environment variable in Render dashboard to your backend URL.

### Update api.js to handle this properly:

The current code should work, but make sure it uses the env var:

```javascript
const API = import.meta.env.VITE_API || (import.meta.env.PROD ? "" : "http://localhost:5001");
```

## Step 4: Update Backend CORS

After you have both URLs, update `backend/app.py`:

```python
import os

# Get frontend URL from environment or use default
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://nourishsteps.onrender.com')

CORS(app, resources={r"/api/*": {
    "origins": [
        "http://localhost:5173",
        "http://localhost:5174",
        FRONTEND_URL,
        "https://*.onrender.com"  # Allow all Render subdomains
    ]
}})
```

## Summary

### Backend Service:
- **Type**: Python Web Service
- **Build**: `cd backend && pip install -r requirements.txt && python -c "from models import Base, engine; Base.metadata.create_all(engine)"`
- **Start**: `cd backend && gunicorn app:app --bind 0.0.0.0:$PORT`
- **Env Vars**: `PORT` (auto), `FLASK_ENV=production`

### Frontend Service:
- **Type**: Static Site (or Node.js Web Service)
- **Build**: `cd frontend && npm install && npm run build`
- **Publish**: `frontend/dist`
- **Env Vars**: `VITE_API=https://nourishsteps-backend.onrender.com`

## Advantages of This Approach

✅ Simpler - No Docker knowledge needed  
✅ Easier debugging - Native Render logs  
✅ Free tier friendly - Static sites are free  
✅ Independent scaling - Scale frontend/backend separately  
✅ Faster builds - Render optimizes native builds  

## Database Note

Same as Docker: SQLite is ephemeral on free tier. For production, use Render PostgreSQL.

