# Render Quick Start - Native Services (Recommended)

## Why Native Services Instead of Docker?

✅ **Simpler**: No Docker knowledge needed  
✅ **Faster builds**: Render optimizes native builds  
✅ **Easier debugging**: Better logs and error messages  
✅ **Free tier friendly**: Static sites are free  
✅ **Independent scaling**: Scale frontend/backend separately  

## Two Services to Create

### 1. Backend (Python Web Service)

**Settings:**
- **Name**: `nourishsteps-backend`
- **Environment**: `Python 3`
- **Build Command**: 
  ```bash
  cd backend && pip install -r requirements.txt && python -c "from models import Base, engine; Base.metadata.create_all(engine)"
  ```
- **Start Command**: 
  ```bash
  cd backend && gunicorn app:app --bind 0.0.0.0:$PORT
  ```
- **Root Directory**: Leave blank

**Environment Variables:**
- `FLASK_ENV`: `production`
- `PORT`: (auto-set by Render)

**After deployment, note your backend URL**: `https://nourishsteps-backend.onrender.com`

---

### 2. Frontend (Static Site)

**Settings:**
- **Name**: `nourishsteps` (or your preferred name)
- **Build Command**: 
  ```bash
  cd frontend && npm install && npm run build
  ```
- **Publish Directory**: `frontend/dist`
- **Root Directory**: Leave blank

**Environment Variables:**
- `VITE_API`: `https://nourishsteps-backend.onrender.com` (use your actual backend URL)

---

## That's It! 🎉

Your app will be live at: `https://nourishsteps.onrender.com`

The frontend will automatically call your backend API.

## Notes

- **Database**: SQLite is ephemeral on free tier (resets on restart). For production, use Render PostgreSQL.
- **CORS**: Already configured to work with Render URLs.
- **API URL**: Frontend uses `VITE_API` env var in production.

