#!/usr/bin/env python3
"""Inspect a few rows from the development database. Does not print DATABASE_URL."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.db import get_connection


def main() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT now()")
            print("now:", cur.fetchone()[0])

            cur.execute(
                """
                SELECT id, name, city, country
                FROM properties
                LIMIT 20
                """
            )
            rows = cur.fetchall()
            print(f"properties ({len(rows)} rows):")
            for row in rows:
                print(row)

            cur.execute(
                """
                SELECT id, name, city, category
                FROM service_providers
                LIMIT 20
                """
            )
            rows = cur.fetchall()
            print(f"service_providers ({len(rows)} rows):")
            for row in rows:
                print(row)


if __name__ == "__main__":
    main()
