# NourishSteps (Full Stack) — Pastel Theme

A gentle, portfolio-ready ED recovery companion (demo) built with **React + Vite + Tailwind + DaisyUI** on the frontend and **Flask + SQLite + SQLAlchemy** on the backend.

> ⚠️ Educational demo only — not medical advice. Crisis: call **988** (US) or your local emergency number.

## Quick Start

### 1) Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -c "from models import Base, engine; Base.metadata.create_all(engine)"
python seed.py
python app.py
# -> http://localhost:5001
```

### 2) Frontend
```bash
cd ../frontend
npm i
echo 'VITE_API=http://localhost:5001' > .env
npm run dev
# -> http://localhost:5173
```

### Pages
- Home (value prop + quick nav)
- Check-In (mood/urge/meal + note)
- Toolbox (coping cards with modal steps)
- Meal (5-min support timer with prompts)
- Resources (crisis & support links)
- Progress (last 7 days stats + mini bars)

### Design
- **Pastel** DaisyUI theme for a soft, reassuring palette.
- Tailwind utility classes for spacing, layout, and rounded cards.
- Accessible copy and crisis notice on Home and footer.

---

© 2025 NourishSteps — for portfolio demonstration purposes only.
