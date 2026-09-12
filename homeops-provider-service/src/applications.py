"""Resolve participants, create repair applications, and handle provider replies."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb

from src.action_tokens import issue_action_token, token_digest, verify_action_token
from src.db import get_connection
from src.matching import MatchSignals, find_best_engineers, find_best_engineers_with_discovery
from src.residence import get_residence_by_telegram
from src.webhooks import emit_telegram_event


def _jsonable(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def get_property(property_id: str) -> dict[str, Any] | None:
    try:
        UUID(str(property_id))
    except ValueError:
        return None

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id, landlord_id, name, address_line1, address_line2,
                    city, region, postal_code, country,
                    latitude, longitude, property_type, units, notes,
                    created_at, updated_at
                FROM properties
                WHERE id = %s
                """,
                (str(property_id),),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d.name for d in cur.description]

    prop = {c: _jsonable(v) for c, v in zip(cols, row)}
    address_parts = [prop.get("address_line1"), prop.get("address_line2")]
    prop["address"] = ", ".join(p for p in address_parts if p)
    return prop


def get_landlord(landlord_id: str | None) -> dict[str, Any] | None:
    if not landlord_id:
        return None
    try:
        UUID(str(landlord_id))
    except ValueError:
        return None

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id, name, email, phone, telegram_id, company_name,
                    notes, created_at, updated_at
                FROM landlords
                WHERE id = %s
                """,
                (str(landlord_id),),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d.name for d in cur.description]

    return {c: _jsonable(v) for c, v in zip(cols, row)}


def match_participants(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Return contacts for tenant, landlord, and best engineer.
    Requires telegram_id of the requester (resident).
    Does not create an application / work order.
    """
    categories = [str(value).strip() for value in payload.get("categories") or [] if str(value).strip()]
    brands = [str(value).strip() for value in payload.get("brands") or [] if str(value).strip()]
    if not categories:
        raise ValueError("categories is required")

    telegram_id = payload.get("telegram_id")
    if not telegram_id:
        raise ValueError("telegram_id is required")

    residence = get_residence_by_telegram(str(telegram_id))
    if not residence:
        raise LookupError(f"No active residence for telegram_id={telegram_id}")

    tenant = residence["tenant"]
    prop = residence["property"]
    landlord = residence["landlord"]

    signals = MatchSignals(
        categories=categories,
        brands=brands,
        city=prop.get("city"),
        country=prop.get("country"),
        latitude=prop.get("latitude"),
        longitude=prop.get("longitude"),
    )
    match_result = find_best_engineers_with_discovery(signals, limit=3)
    engineer = match_result["match"]

    return {
        "tenant": tenant,
        "property": prop,
        "landlord": landlord,
        "engineer": engineer,
        "alternatives": match_result["alternatives"],
        "signals": match_result["signals"],
        "discovery_triggered": match_result["discovery_triggered"],
        "manual_review_required": engineer is None,
        "message": (
            "A suitable provider was found."
            if engineer
            else "No provider with the requested specialty is available in the demo directory."
        ),
        "contacts": {
            "tenant_telegram_id": tenant.get("telegram_id") or str(telegram_id),
            "landlord_telegram_id": (landlord or {}).get("telegram_id"),
            "engineer_telegram_id": (engineer or {}).get("telegram_id"),
            "tenant_phone": tenant.get("phone"),
            "landlord_phone": (landlord or {}).get("phone"),
            "engineer_phone": (engineer or {}).get("phone"),
            "landlord_email": (landlord or {}).get("email"),
            "engineer_email": (engineer or {}).get("email"),
        },
    }


def _create_provider_attempt(cur, application_id: str, provider_id: str) -> dict[str, str]:
    cur.execute(
        """
        INSERT INTO service_request_provider_attempts (
            service_request_id, provider_id, action_token_hash, expires_at
        )
        VALUES (%s, %s, %s, now() + interval '48 hours')
        RETURNING id
        """,
        (application_id, provider_id, "pending"),
    )
    attempt_id = str(cur.fetchone()[0])
    token = issue_action_token(attempt_id, application_id, provider_id)
    cur.execute(
        "UPDATE service_request_provider_attempts SET action_token_hash = %s WHERE id = %s",
        (token_digest(token), attempt_id),
    )
    return {"attempt_id": attempt_id, "token": token, "expires_in_hours": "48"}


def _application_context(application_id: str) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT sr.id, sr.status, sr.summary, sr.categories, sr.brands, sr.urgency,
                       sr.findings, sr.created_at, sr.updated_at,
                       t.id, t.name, t.telegram_id, t.phone,
                       p.id, p.name, p.address_line1, p.address_line2, p.city, p.country,
                       l.id, l.name, l.telegram_id, l.phone, l.email,
                       sp.id, sp.name, sp.telegram_id, sp.phone, sp.email
                FROM service_requests sr
                LEFT JOIN tenants t ON t.id = sr.tenant_id
                LEFT JOIN properties p ON p.id = sr.property_id
                LEFT JOIN landlords l ON l.id = p.landlord_id
                LEFT JOIN service_providers sp ON sp.id = sr.provider_id
                WHERE sr.id = %s
                """,
                (application_id,),
            )
            row = cur.fetchone()
            if not row:
                raise LookupError("Application not found")

    values = [_jsonable(value) for value in row]
    (
        app_id, status, summary, categories, brands, urgency, findings, created_at, updated_at,
        tenant_id, tenant_name, tenant_telegram_id, tenant_phone,
        property_id, property_name, address_line1, address_line2, city, country,
        landlord_id, landlord_name, landlord_telegram_id, landlord_phone, landlord_email,
        provider_id, provider_name, provider_telegram_id, provider_phone, provider_email,
    ) = values
    address = ", ".join(value for value in (address_line1, address_line2) if value)
    return {
        "application_id": app_id,
        "status": status,
        "summary": summary,
        "categories": categories or [],
        "brands": brands or [],
        "urgency": urgency,
        "findings": findings or {},
        "created_at": created_at,
        "updated_at": updated_at,
        "tenant": {"id": tenant_id, "name": tenant_name, "telegram_id": tenant_telegram_id, "phone": tenant_phone},
        "property": {"id": property_id, "name": property_name, "address": address, "city": city, "country": country},
        "landlord": {"id": landlord_id, "name": landlord_name, "telegram_id": landlord_telegram_id, "phone": landlord_phone, "email": landlord_email},
        "engineer": ({"id": provider_id, "name": provider_name, "telegram_id": provider_telegram_id, "phone": provider_phone, "email": provider_email} if provider_id else None),
    }


def _emit(event: str, application_id: str) -> dict[str, Any]:
    # The connected Telegram agent currently exposes an acceptance-only
    # endpoint. Creation and reassignment details are returned to the caller,
    # which can use them to send the next mechanic email.
    if event != "application.accepted":
        return {"delivered": False, "reason": "event_not_supported_by_telegram_webhook"}
    try:
        application = _application_context(application_id)
        return emit_telegram_event(
            "technician_task_accepted",
            {
                "incident_id": application["application_id"],
                "tenant_telegram_id": application["tenant"].get("telegram_id"),
                "landlord_telegram_id": application["landlord"].get("telegram_id"),
                "technician": application["engineer"],
                "message": "The technician has accepted the maintenance request.",
            },
        )
    except Exception as exc:  # Application state is already safely committed.
        return {"delivered": False, "reason": str(exc)}


def create_application(payload: dict[str, Any]) -> dict[str, Any]:
    """Match, persist, and prepare one provider invitation for the Telegram agent."""
    summary = str(payload.get("summary") or "").strip()
    if not summary:
        raise ValueError("summary is required when creating an application")

    match = match_participants(payload)
    engineer = match["engineer"]
    status = "pending_provider" if engineer else "manual_review"
    prop = match["property"]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO service_requests (
                    status, summary, categories, brands, city, country, latitude, longitude,
                    property_id, property_address, urgency, findings, provider_id,
                    match_score, match_reasons, requester_telegram_id, tenant_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    status, summary, match["signals"]["categories"], match["signals"]["brands"],
                    prop.get("city"), prop.get("country"), prop.get("latitude"), prop.get("longitude"),
                    prop["id"], prop.get("address"), payload.get("urgency", "normal"),
                    Jsonb(payload.get("findings") or {}), engineer and engineer["id"],
                    engineer and engineer.get("match_score"),
                    engineer.get("match_reasons", []) if engineer else [],
                    str(payload["telegram_id"]), match["tenant"]["id"],
                ),
            )
            application_id = str(cur.fetchone()[0])
            provider_action = (
                _create_provider_attempt(cur, application_id, engineer["id"])
                if engineer else None
            )
        conn.commit()

    webhook = _emit("application.created", application_id)
    return {
        "ok": True,
        "application": _application_context(application_id),
        "provider_action": provider_action,
        "manual_review_required": engineer is None,
        "webhook": webhook,
    }


def respond_to_application(
    application_id: str, token: str, decision: str, decline_reason: str | None = None
) -> dict[str, Any]:
    """Accept or decline a pending mechanic invitation using its one-time token."""
    claims = verify_action_token(token)
    if claims["application_id"] != str(application_id):
        raise PermissionError("Action token belongs to a different application")
    if decision not in {"accept", "decline"}:
        raise ValueError("decision must be accept or decline")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT sr.id, sr.categories, sr.brands, sr.city, sr.country, sr.latitude, sr.longitude,
                       a.provider_id, a.status, a.action_token_hash
                FROM service_request_provider_attempts a
                JOIN service_requests sr ON sr.id = a.service_request_id
                WHERE a.id = %s AND sr.id = %s
                FOR UPDATE OF a, sr
                """,
                (claims["attempt_id"], application_id),
            )
            row = cur.fetchone()
            if not row:
                raise LookupError("Application invitation not found")
            app_id, categories, brands, city, country, latitude, longitude, provider_id, attempt_status, stored_hash = row
            if str(provider_id) != claims["provider_id"] or token_digest(token) != stored_hash:
                raise PermissionError("Invalid action token")
            if attempt_status != "pending":
                raise ValueError("This invitation has already been answered")

            if decision == "accept":
                cur.execute(
                    """
                    UPDATE service_request_provider_attempts
                    SET status = 'accepted', responded_at = now()
                    WHERE id = %s
                    """,
                    (claims["attempt_id"],),
                )
                cur.execute(
                    "UPDATE service_requests SET status = 'accepted', updated_at = now() WHERE id = %s",
                    (app_id,),
                )
                provider_action = None
                event = "application.accepted"
            else:
                cur.execute(
                    """
                    UPDATE service_request_provider_attempts
                    SET status = 'declined', decline_reason = %s, responded_at = now()
                    WHERE id = %s
                    """,
                    (decline_reason, claims["attempt_id"]),
                )
                cur.execute(
                    "SELECT provider_id FROM service_request_provider_attempts WHERE service_request_id = %s",
                    (app_id,),
                )
                excluded = {str(provider[0]) for provider in cur.fetchall()}
                next_match = find_best_engineers(
                    MatchSignals(categories=categories, brands=brands, city=city, country=country, latitude=latitude, longitude=longitude),
                    limit=1,
                    exclude_provider_ids=excluded,
                )["match"]
                if next_match:
                    cur.execute(
                        """
                        UPDATE service_requests
                        SET status = 'pending_provider', provider_id = %s, match_score = %s,
                            match_reasons = %s, updated_at = now()
                        WHERE id = %s
                        """,
                        (next_match["id"], next_match["match_score"], next_match["match_reasons"], app_id),
                    )
                    provider_action = _create_provider_attempt(cur, str(app_id), next_match["id"])
                    event = "application.reassigned"
                else:
                    cur.execute(
                        """
                        UPDATE service_requests
                        SET status = 'manual_review', provider_id = NULL, updated_at = now()
                        WHERE id = %s
                        """,
                        (app_id,),
                    )
                    provider_action = None
                    event = "application.manual_review_required"
        conn.commit()

    webhook = _emit(event, str(application_id))
    return {
        "ok": True,
        "application": _application_context(str(application_id)),
        "provider_action": provider_action,
        "webhook": webhook,
    }
