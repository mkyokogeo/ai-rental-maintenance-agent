"""Short-lived, tamper-proof tokens for a provider's application response."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import time
from typing import Any


def _secret() -> bytes:
    value = os.environ.get("APPLICATION_ACTION_SECRET")
    if not value:
        raise RuntimeError("APPLICATION_ACTION_SECRET is not configured")
    return value.encode()


def issue_action_token(attempt_id: str, application_id: str, provider_id: str) -> str:
    payload = {
        "attempt_id": attempt_id,
        "application_id": application_id,
        "provider_id": provider_id,
        "exp": int(time.time()) + 48 * 60 * 60,
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).rstrip(b"=")
    signature = hmac.new(_secret(), encoded, hashlib.sha256).digest()
    return f"{encoded.decode()}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def verify_action_token(token: str) -> dict[str, Any]:
    try:
        encoded, supplied_signature = token.split(".", 1)
        expected = hmac.new(_secret(), encoded.encode(), hashlib.sha256).digest()
        actual = base64.urlsafe_b64decode(supplied_signature + "=" * (-len(supplied_signature) % 4))
        payload = json.loads(
            base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        )
    except (ValueError, UnicodeDecodeError, binascii.Error, json.JSONDecodeError) as exc:
        raise PermissionError("Invalid action token") from exc

    if not hmac.compare_digest(expected, actual) or int(payload.get("exp", 0)) < time.time():
        raise PermissionError("Invalid or expired action token")
    if not all(payload.get(key) for key in ("attempt_id", "application_id", "provider_id")):
        raise PermissionError("Invalid action token")
    return payload


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
