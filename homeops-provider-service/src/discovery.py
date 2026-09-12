"""Client for discovering providers in cities not yet in the local directory."""

from __future__ import annotations

import os

import httpx


DEFAULT_DISCOVERY_URL = "https://huff-dastardly-shawl.ngrok-free.dev/specialists"


def discover_specialists(city: str) -> None:
    """Ask the discovery service to populate providers for ``city``.

    The discovery service persists its results in the same provider database,
    so callers should query the directory again after this function returns.
    """
    url = os.environ.get("SPECIALIST_DISCOVERY_URL", DEFAULT_DISCOVERY_URL)
    timeout_seconds = float(os.environ.get("SPECIALIST_DISCOVERY_TIMEOUT_SECONDS", "120"))

    try:
        response = httpx.post(url, json={"city": city}, timeout=timeout_seconds)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Provider discovery is unavailable for {city!r}: {exc}") from exc
