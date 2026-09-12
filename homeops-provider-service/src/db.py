import os

import psycopg
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    """Connect using DATABASE_URL from the environment (e.g. Supabase pooler)."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env and add your "
            "Supabase Session pooler connection string."
        )
    return psycopg.connect(database_url)
