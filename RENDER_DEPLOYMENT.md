# Render Deployment Guide

## Quick Setup

### 1. Render Web Service Configuration

Fill in the Render form with these values:

- **Name**: `nourishsteps` (or your preferred name)
- **Project (Optional)**: Leave blank or create a project
- **Language**: `Docker` ✅
- **Branch**: `main` ✅
- **Region**: `Oregon (US West)` or your preferred region
- **Root Directory**: **Leave blank** (Dockerfile is at project root)

### 2. Environment Variables (Optional)

You don't need to set any environment variables for basic deployment. The app will:
- Use relative API paths in production (handled by nginx proxy)
- Create the database automatically on first run
- Run on port 80 (handled by nginx)

### 3. Build & Deploy Settings

Render will automatically:
- Detect the Dockerfile at the root
- Build the multi-stage Docker image
- Run the container with the startup script

### 4. After Deployment

Once deployed, your app will be available at:
- `https://nourishsteps.onrender.com` (or your custom domain)

The Dockerfile:
- Builds the React frontend
- Sets up Flask backend
- Configures nginx to serve frontend and proxy `/api` to backend
- Initializes the SQLite database

## Database Persistence

⚠️ **Important**: Render's free tier has **ephemeral storage**. Your SQLite database will be lost when the service restarts.

### Solutions:

1. **Use Render PostgreSQL** (Recommended for production):
   - Create a PostgreSQL database in Render
   - Update `backend/models.py` to use PostgreSQL instead of SQLite
   - Set `DATABASE_URL` environment variable

2. **Use Render Disk** (Paid feature):
   - Add a persistent disk to your service
   - Mount it to `/app/backend/nourish.db`

3. **Accept ephemeral storage** (For demo/portfolio):
   - Database resets on each deploy
   - Fine for showcasing the app

## Custom Domain (Optional)

1. Go to your service settings in Render
2. Click "Custom Domains"
3. Add your domain and follow DNS instructions

## Monitoring

- Check logs in Render dashboard
- Monitor service health at `/api/health`
- View build logs if deployment fails

## Troubleshooting

### Build Fails
- Check that Dockerfile is at project root
- Verify all dependencies are in `requirements.txt` and `package.json`
- Check build logs in Render dashboard

### App Doesn't Load
- Check service logs for errors
- Verify nginx is running: `curl https://your-app.onrender.com/api/health`
- Check that port 80 is exposed in Dockerfile

### API Calls Fail
- Verify nginx proxy configuration
- Check CORS settings (shouldn't be needed with nginx, but verify)
- Check backend logs for errors

## Next Steps

1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to Render
3. Create a new Web Service
4. Fill in the form as described above
5. Deploy! 🚀

