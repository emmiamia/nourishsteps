# NourishSteps 🌱

A gentle, full-stack web application designed as a supportive companion for recovery. Built with modern technologies and a focus on user experience, accessibility, and code quality.

> ⚠️ **Educational demo only** — not medical advice. Crisis: call **988** (US) or your local emergency number.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.2-blue)
![Flask](https://img.shields.io/badge/Flask-3.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

## ✨ Features

### Core Functionality
- **Daily Check-In**: Track mood (1-5), urges (0-5), meal status, and personal notes
- **Meal Tracking**: Log breakfast, lunch, dinner, and snacks with optional timer support
- **Meal Timer**: Multi-phase timer (meal + post-meal) with gentle prompts
- **Calendar View**: Visual calendar showing daily entries with color-coded heatmap
- **Progress Dashboard**: Beautiful charts and statistics for mood, urges, and meal completion
- **Coping Toolbox**: Interactive cards with step-by-step coping strategies
- **Resources**: Curated list of crisis and support resources

### Technical Features
- ✅ **Error Boundaries**: Graceful error handling with React Error Boundary
- ✅ **Loading States**: Skeleton screens for better UX
- ✅ **Code Splitting**: Lazy loading for optimal performance
- ✅ **Dark Mode**: Toggle between light and dark themes
- ✅ **PWA Support**: Installable as a Progressive Web App
- ✅ **Responsive Design**: Mobile-first, works on all devices
- ✅ **TypeScript Ready**: TypeScript configuration included
- ✅ **E2E Testing**: Playwright tests for critical user flows
- ✅ **Docker Support**: Easy deployment with Docker Compose

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **DaisyUI** - Component library on top of Tailwind
- **Framer Motion** - Animation library
- **Recharts** - Chart library for data visualization
- **React Router** - Client-side routing
- **Lucide React** - Icon library

### Backend
- **Flask 3.0** - Python web framework
- **SQLAlchemy 2.0** - ORM for database operations
- **SQLite** - Lightweight database
- **Flask-CORS** - Cross-origin resource sharing

### Testing & Quality
- **Pytest** - Python testing framework
- **Vitest** - Fast unit test framework
- **Playwright** - E2E testing
- **TypeScript** - Type safety (configuration ready)

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Web server and reverse proxy

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm
- Python 3.11+
- Docker (optional, for containerized deployment)

### Local Development

#### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -c "from models import Base, engine; Base.metadata.create_all(engine)"
python seed.py  # Optional: seed with sample data
python app.py
# Backend runs on http://localhost:5001
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
echo 'VITE_API=http://localhost:5001' > .env
npm run dev
# Frontend runs on http://localhost:5173
```

### Docker Deployment
```bash
# Build and run
docker-compose up -d --build

# Access at http://localhost
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 📁 Project Structure

```
nourishsteps/
├── backend/
│   ├── app.py              # Flask API routes
│   ├── models.py           # SQLAlchemy models
│   ├── test_app.py         # Backend tests
│   ├── requirements.txt    # Python dependencies
│   └── seed.py             # Database seeding script
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   │   ├── CalendarDiary.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── MealTimer.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   └── ThemeToggle.jsx
│   │   ├── pages/          # Page components
│   │   ├── api.js          # API client
│   │   └── App.jsx         # Main app component
│   ├── tests/
│   │   └── e2e/            # E2E tests
│   ├── public/             # Static assets
│   └── package.json
├── docker/                  # Docker configuration
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest test_app.py -v
pytest test_app.py --cov=. --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test              # Unit tests (when configured)
npm run test:e2e      # E2E tests with Playwright
```

## 📸 Features Showcase

### Pages Overview
1. **Home**: Welcome page with feature cards and quick navigation
2. **Check-In**: Daily mood and meal tracking with note-taking
3. **Meals**: Calendar view, meal logging, and timer support
4. **Progress**: Data visualization with charts and statistics
5. **Toolbox**: Coping strategies with interactive modals
6. **Resources**: Crisis and support resource links

### Key Features
- **Calendar Heatmap**: Visual representation of daily activity
- **Streak Tracking**: Consecutive days with entries
- **Meal Statistics**: Completion rates and patterns
- **Mood Trends**: Visual charts showing mood over time
- **Responsive Design**: Works seamlessly on mobile and desktop

## 🎨 Design Philosophy

- **Calming Green Theme**: Soothing color palette designed to reduce anxiety
- **Gentle Animations**: Smooth transitions and micro-interactions
- **Accessibility First**: Semantic HTML, ARIA labels, keyboard navigation
- **Mobile-First**: Responsive design that works on all screen sizes

## 🔒 Security & Privacy

- All data stored locally (SQLite database)
- No external analytics or tracking
- CORS configured for development
- Input validation on all API endpoints

## 📝 API Documentation

### Check-Ins
- `GET /api/checkins` - List check-ins (with optional date filter)
- `POST /api/checkins` - Create new check-in
- `PATCH /api/checkins/:id` - Update check-in
- `DELETE /api/checkins/:id` - Delete check-in
- `GET /api/checkins/month` - Get monthly summary
- `GET /api/summary7` - Get 7-day summary

### Meals
- `GET /api/meals` - List meals (with optional date filter)
- `POST /api/meals` - Create new meal log
- `PATCH /api/meals/:id` - Update meal
- `DELETE /api/meals/:id` - Delete meal
- `GET /api/meals/month` - Get monthly meal summary
- `GET /api/meals/summary7` - Get 7-day meal statistics

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Docker deployment
- Production server setup
- Cloud deployment options (Vercel, Railway, Heroku)
- Database backup strategies

## 🤝 Contributing

This is a portfolio project. For suggestions or improvements:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is for educational and portfolio demonstration purposes.

## 🙏 Acknowledgments

- Built with care for those on their recovery journey
- Inspired by evidence-based recovery practices
- Designed with accessibility and user experience in mind

---

**Note**: This application is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.
