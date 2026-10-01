"""Opt-in, local synthetic-data reflection agent."""
from pathlib import Path
from dotenv import load_dotenv

# Local secrets stay ignored by git. Existing environment variables take precedence.
load_dotenv(Path(__file__).resolve().parents[1] / '.env', override=False)
