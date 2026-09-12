"""Match engineers from property location + structured tags from upstream."""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from src.db import get_connection
from src.discovery import discover_specialists


@dataclass
class MatchSignals:
    categories: list[str] = field(default_factory=list)
    brands: list[str] = field(default_factory=list)
    city: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None


def _normalise(values: list[str]) -> list[str]:
    """Remove empty values and make tag comparison predictable."""
    return sorted({str(value).strip().casefold() for value in values if str(value).strip()})


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _score_provider(provider: dict, signals: MatchSignals) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []

    provider_cats = set(_normalise(provider.get("categories") or []))
    provider_brands = set(_normalise(provider.get("brands") or []))
    requested_cats = set(_normalise(signals.categories))
    requested_brands = set(_normalise(signals.brands))

    matched_cats = provider_cats.intersection(requested_cats)
    if matched_cats:
        score += 3.0 * len(matched_cats)
        reasons.append(f"categories: {', '.join(sorted(matched_cats))}")

    matched_brands = provider_brands.intersection(requested_brands)
    if matched_brands:
        score += 2.0 * len(matched_brands)
        reasons.append(f"brands: {', '.join(sorted(matched_brands))}")

    if signals.city and provider.get("city"):
        if provider["city"].lower() == signals.city.lower():
            score += 2.0
            reasons.append(f"city: {provider['city']}")

    if signals.country and provider.get("country"):
        if provider["country"].lower() == signals.country.lower():
            score += 0.5
            reasons.append(f"country: {provider['country']}")

    if (
        signals.latitude is not None
        and signals.longitude is not None
        and provider.get("latitude") is not None
        and provider.get("longitude") is not None
    ):
        dist = _haversine_km(
            signals.latitude,
            signals.longitude,
            float(provider["latitude"]),
            float(provider["longitude"]),
        )
        provider["distance_km"] = round(dist, 2)
        proximity = max(0.0, 2.0 - dist / 10.0)
        if proximity > 0:
            score += proximity
            reasons.append(f"distance: {provider['distance_km']} km")

    return score, reasons


def find_best_engineers(
    signals: MatchSignals,
    *,
    limit: int = 3,
    exclude_provider_ids: set[str] | None = None,
) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id, name, phone, email, website, telegram_id,
                    city, country, latitude, longitude,
                    categories, brands
                FROM service_providers
                ORDER BY created_at DESC
                LIMIT 500
                """
            )
            cols = [d.name for d in cur.description]
            providers = [dict(zip(cols, row)) for row in cur.fetchall()]

    excluded = {str(provider_id) for provider_id in (exclude_provider_ids or set())}
    requested_categories = _normalise(signals.categories)
    ranked: list[dict] = []
    for provider in providers:
        provider["id"] = str(provider["id"])
        score, reasons = _score_provider(provider, signals)
        # A city or a phone number does not make a plumber suitable for an HVAC
        # problem. For this demo, a provider must explicitly support at least
        # one requested category.
        provider["category_match"] = bool(
            set(_normalise(provider.get("categories") or []))
            .intersection(requested_categories)
        )
        provider["match_score"] = round(score, 3)
        provider["match_reasons"] = reasons
        ranked.append(provider)

    ranked.sort(key=lambda p: (-p["match_score"], p["name"].casefold()))
    top = [
        p for p in ranked
        if p["category_match"] and p["id"] not in excluded
    ][:limit]

    best = top[0] if top else None
    return {
        "signals": {
            "categories": requested_categories,
            "brands": _normalise(signals.brands),
            "city": signals.city,
            "country": signals.country,
        },
        "match": contact_payload(best) if best else None,
        "alternatives": [contact_payload(p) for p in top[1:]],
    }


def has_providers_in_city(city: str | None) -> bool:
    """Return whether discovery has already populated this city."""
    if not city or not city.strip():
        return True

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS(
                    SELECT 1
                    FROM service_providers
                    WHERE lower(city) = lower(%s)
                )
                """,
                (city.strip(),),
            )
            return bool(cur.fetchone()[0])


def find_best_engineers_with_discovery(signals: MatchSignals, *, limit: int = 3) -> dict:
    """Match providers, discovering a city once when it has no directory entries."""
    discovered = False
    if not has_providers_in_city(signals.city):
        # This call waits for the discovery service because it writes providers
        # to the shared database used by the next matching query.
        discover_specialists(signals.city.strip())
        discovered = True

    result = find_best_engineers(signals, limit=limit)
    result["discovery_triggered"] = discovered
    return result


def contact_payload(provider: dict | None) -> dict | None:
    if not provider:
        return None
    return {
        "id": provider["id"],
        "name": provider["name"],
        "phone": provider.get("phone"),
        "email": provider.get("email"),
        "website": provider.get("website"),
        "telegram_id": provider.get("telegram_id"),
        "city": provider.get("city"),
        "country": provider.get("country"),
        "categories": provider.get("categories") or [],
        "brands": provider.get("brands") or [],
        "distance_km": provider.get("distance_km"),
        "match_score": provider.get("match_score"),
        "match_reasons": provider.get("match_reasons") or [],
    }
