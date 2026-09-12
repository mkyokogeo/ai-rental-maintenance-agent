"""Residence lookup: telegram user → tenant, full property, full landlord."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from src.db import get_connection


def _jsonable(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _row_to_dict(cols: list[str], row: tuple, *, prefix: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for col, val in zip(cols, row):
        if not col.startswith(prefix):
            continue
        key = col[len(prefix) :]
        data[key] = _jsonable(val)
    return data


def get_residence_by_telegram(telegram_id: str) -> dict[str, Any] | None:
    telegram_id = str(telegram_id).strip()
    if not telegram_id:
        return None

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    t.id AS t_id,
                    t.property_id AS t_property_id,
                    t.name AS t_name,
                    t.telegram_id AS t_telegram_id,
                    t.phone AS t_phone,
                    t.email AS t_email,
                    t.is_active AS t_is_active,
                    t.moved_in_at AS t_moved_in_at,
                    t.moved_out_at AS t_moved_out_at,
                    t.created_at AS t_created_at,
                    t.updated_at AS t_updated_at,

                    p.id AS p_id,
                    p.landlord_id AS p_landlord_id,
                    p.name AS p_name,
                    p.address_line1 AS p_address_line1,
                    p.address_line2 AS p_address_line2,
                    p.city AS p_city,
                    p.region AS p_region,
                    p.postal_code AS p_postal_code,
                    p.country AS p_country,
                    p.latitude AS p_latitude,
                    p.longitude AS p_longitude,
                    p.property_type AS p_property_type,
                    p.units AS p_units,
                    p.notes AS p_notes,
                    p.created_at AS p_created_at,
                    p.updated_at AS p_updated_at,

                    l.id AS l_id,
                    l.name AS l_name,
                    l.email AS l_email,
                    l.phone AS l_phone,
                    l.telegram_id AS l_telegram_id,
                    l.company_name AS l_company_name,
                    l.notes AS l_notes,
                    l.created_at AS l_created_at,
                    l.updated_at AS l_updated_at
                FROM tenants t
                JOIN properties p ON p.id = t.property_id
                LEFT JOIN landlords l ON l.id = p.landlord_id
                WHERE t.telegram_id = %s
                  AND t.is_active = TRUE
                ORDER BY t.moved_in_at DESC
                LIMIT 1
                """,
                (telegram_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d.name for d in cur.description]

    tenant = _row_to_dict(cols, row, prefix="t_")
    prop = _row_to_dict(cols, row, prefix="p_")
    landlord = _row_to_dict(cols, row, prefix="l_")

    address_parts = [prop.get("address_line1"), prop.get("address_line2")]
    prop["address"] = ", ".join(p for p in address_parts if p)

    if not landlord.get("id"):
        landlord = None

    return {
        "tenant": tenant,
        "property": prop,
        "landlord": landlord,
    }
