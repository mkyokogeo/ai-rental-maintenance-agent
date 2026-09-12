"""Send application events to the Telegram agent, when configured."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx


def emit_telegram_event(event: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = os.environ.get("TELEGRAM_AGENT_WEBHOOK_URL")
    if not url:
        return {"delivered": False, "reason": "webhook_not_configured"}

    body = json.dumps({"event": event, **payload}, separators=(",", ":"), default=str)
    headers = {"Content-Type": "application/json"}
    secret = os.environ.get("TELEGRAM_AGENT_WEBHOOK_SECRET")
    if secret:
        timestamp = str(int(time.time()))
        signature = hmac.new(
            secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256
        ).hexdigest()
        headers["X-HomeOps-Timestamp"] = timestamp
        headers["X-HomeOps-Signature"] = signature
    response = httpx.post(
        url,
        content=body,
        headers=headers,
        timeout=10.0,
    )
    response.raise_for_status()
    return {"delivered": True, "status_code": response.status_code}
