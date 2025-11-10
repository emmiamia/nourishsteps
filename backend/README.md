# NourishSteps — Backend (Flask)

## Setup
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -c "from models import Base, engine; Base.metadata.create_all(engine)"
python seed.py
python app.py
```
The API runs at `http://localhost:5001`.
