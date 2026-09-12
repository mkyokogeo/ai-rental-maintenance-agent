#!/usr/bin/env python3
"""Apply all migrations/*.sql against DATABASE_URL. Does not print secrets."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.db import get_connection

MIGRATIONS_DIR = ROOT / "migrations"


def main() -> None:
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        raise SystemExit(f"No migrations found in {MIGRATIONS_DIR}")

    with get_connection() as conn:
        with conn.cursor() as cur:
            for path in files:
                sql = path.read_text()
                print(f"Applying {path.name} ({len(sql)} bytes)...")
                cur.execute(sql)
        conn.commit()

    print(f"Migration completed ({len(files)} files)")


if __name__ == "__main__":
    main()
