#!/usr/bin/env python3
"""Seed demo landlord, property, tenant (telegram), and technicians."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.db import get_connection

DEMO_TENANT_TELEGRAM_ID = "10001"
DEMO_LANDLORD_TELEGRAM_ID = "20001"
DEMO_ENGINEER_BOSCH_TELEGRAM_ID = "30001"
DEMO_ENGINEER_HVAC_TELEGRAM_ID = "30002"

providers = [
    {
        "name": "Demo Bosch Repair Valencia",
        "city": "Valencia",
        "country": "ES",
        "latitude": 39.47,
        "longitude": -0.37,
        "phone": "+34960000001",
        "telegram_id": DEMO_ENGINEER_BOSCH_TELEGRAM_ID,
        "categories": ["appliance_repair"],
        "brands": ["Bosch", "Siemens"],
    },
    {
        "name": "Demo HVAC Valencia",
        "city": "Valencia",
        "country": "ES",
        "latitude": 39.46,
        "longitude": -0.38,
        "phone": "+34960000002",
        "telegram_id": DEMO_ENGINEER_HVAC_TELEGRAM_ID,
        "categories": ["hvac"],
        "brands": ["Daikin", "Mitsubishi"],
    },
]


def main() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO landlords (name, email, phone, company_name, telegram_id)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    "Demo Landlord Valencia",
                    "landlord@example.com",
                    "+34961000000",
                    "Demo Housing SL",
                    DEMO_LANDLORD_TELEGRAM_ID,
                ),
            )
            landlord_id = cur.fetchone()[0]

            cur.execute(
                """
                INSERT INTO properties (
                    landlord_id, name, address_line1, city, country,
                    latitude, longitude, property_type, units
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, city
                """,
                (
                    landlord_id,
                    "Demo Apartment Colón",
                    "Carrer de Colón 12",
                    "Valencia",
                    "ES",
                    39.4702,
                    -0.3763,
                    "apartment",
                    1,
                ),
            )
            prop = cur.fetchone()
            property_id = prop[0]
            print("property_id:", property_id)
            print("property:", prop[1], prop[2])

            cur.execute(
                """
                INSERT INTO tenants (property_id, name, telegram_id, phone, email)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, telegram_id
                """,
                (
                    property_id,
                    "Demo Tenant Ana",
                    DEMO_TENANT_TELEGRAM_ID,
                    "+34962000000",
                    "tenant@example.com",
                ),
            )
            tenant = cur.fetchone()
            print("tenant_id:", tenant[0])
            print("tenant_telegram_id:", tenant[1])

            for p in providers:
                cur.execute(
                    """
                    INSERT INTO service_providers (
                        name, city, country, latitude, longitude,
                        phone, telegram_id, categories, brands
                    )
                    VALUES (
                        %(name)s, %(city)s, %(country)s, %(latitude)s, %(longitude)s,
                        %(phone)s, %(telegram_id)s, %(categories)s, %(brands)s
                    )
                    RETURNING id, name, telegram_id
                    """,
                    p,
                )
                print("provider:", cur.fetchone())
        conn.commit()

    print("landlord_telegram_id:", DEMO_LANDLORD_TELEGRAM_ID)
    print("Seed completed")


if __name__ == "__main__":
    main()
