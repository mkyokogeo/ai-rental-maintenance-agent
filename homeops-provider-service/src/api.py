from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from src.applications import create_application, match_participants, respond_to_application

app = FastAPI(
    title="HomeOps Provider Service",
    version="0.9.0",
    description=(
        "Match and dispatch rental-maintenance applications."
    ),
)


class MatchRequest(BaseModel):
    telegram_id: str = Field(..., description="Requester (resident) Telegram user id")
    categories: list[str] = Field(..., min_length=1)
    brands: list[str] = Field(default_factory=list)
    urgency: str = Field(
        default="normal",
        description="Demo label from the Telegram classifier, e.g. normal, high, emergency",
    )
    summary: str | None = Field(
        default=None,
        description="Optional; echoed only — not used for matching",
    )
    findings: dict[str, Any] = Field(default_factory=dict)


class ApplicationRequest(MatchRequest):
    summary: str = Field(..., min_length=3, description="Tenant-facing problem summary")


class ProviderActionRequest(BaseModel):
    token: str = Field(..., min_length=20, description="One-time token supplied in the provider email")
    decision: Literal["accept", "decline"]
    decline_reason: str | None = Field(default=None, max_length=500)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/match")
def match(body: MatchRequest):
    """
    From the requester's telegram_id + problem tags, resolve where they live,
    who the landlord is, pick the best engineer, and return all contacts.
    """
    try:
        result = match_participants(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "ok": True,
        "telegram_id": body.telegram_id,
        "summary": body.summary,
        "urgency": body.urgency,
        "findings": body.findings,
        **result,
    }


@app.post("/applications")
def create(body: ApplicationRequest):
    """Create an application and emit an `application.created` Telegram-agent event."""
    try:
        return create_application(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/applications/{application_id}/action")
def provider_action(application_id: str, body: ProviderActionRequest):
    """One-time mechanic accept/decline callback, normally reached via an email confirmation page."""
    try:
        return respond_to_application(
            application_id, body.token, body.decision, body.decline_reason
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/applications/{application_id}/action")
def accept_provider_action(
    application_id: str,
    token: str = Query(..., min_length=20, description="One-time token supplied in the provider email"),
):
    """Accept a provider invitation directly from its signed email link."""
    try:
        return respond_to_application(application_id, token, "accept")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
