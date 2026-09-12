# Architecture and request lifecycle

HomeOps Provider Service is the dispatch component of the maintenance flow. A Telegram-facing agent owns conversation and email delivery; this service owns directory lookup, provider selection, application state, and the provider's signed answer.

## Components

| Component | Responsibility |
| --- | --- |
| `src/api.py` | FastAPI boundary and request validation. |
| `src/residence.py` | Resolves an active tenant, their property, and landlord from a Telegram ID. |
| `src/matching.py` | Selects eligible providers and explains the score. |
| `src/applications.py` | Persists requests, invitation attempts, and acceptance/decline transitions. |
| `src/action_tokens.py` | Issues and validates 48-hour, HMAC-signed, one-time action tokens. |
| `src/webhooks.py` | Optionally notifies the Telegram agent after provider acceptance. |

## Dispatch flow

```mermaid
sequenceDiagram
    participant T as Tenant / Telegram agent
    participant API as Provider Service
    participant DB as PostgreSQL
    participant P as Provider
    participant W as Telegram webhook
    T->>API: POST /applications (telegram_id, tags, summary)
    API->>DB: Find active tenant, property, landlord
    API->>DB: Load providers and rank eligible category matches
    API->>DB: Create service_request + pending provider attempt
    API-->>T: Application + one-time provider action token
    T->>P: Deliver signed acceptance URL in provider email
    P->>API: GET /applications/{id}/action?token=...
    API->>DB: Verify token hash and atomically record decision
    alt accepted
        API->>DB: Set request status to accepted
        API->>W: technician_task_accepted (if configured)
    else declined; alternative exists
        API->>DB: Create next pending attempt and update provider
        API-->>T: Next provider action token
    else declined; no alternative
        API->>DB: Set request status to manual_review
    end
```

## Matching rules

Providers must match at least one requested `categories` value (case insensitive); proximity alone cannot make a provider eligible. Eligible providers are ordered by score, then by case-insensitive name:

| Signal | Score |
| --- | ---: |
| Each matching category | +3.0 |
| Each matching brand | +2.0 |
| Same city | +2.0 |
| Same country | +0.5 |
| Distance | Up to +2.0, decreasing linearly to zero at 20 km |

The API returns the selected provider, up to two alternatives, and the reasons used to score the selected provider. A provider with no category match is never selected. When no eligible provider exists, the request is created with status `manual_review`.

## State and delivery guarantees

`service_requests` is the current application state. Every provider invitation is retained in `service_request_provider_attempts`, so a provider can be tried at most once per request. Tokens are signed, expire after 48 hours, and are also checked against the stored SHA-256 digest. Database updates commit before the optional webhook is attempted; a webhook failure is returned in the response but does not roll back a provider decision.

Only acceptance emits a webhook today. Creation, reassignment, and manual review are returned synchronously to the caller so it can deliver the next invitation or escalate the request.

## Operations

Apply migrations in lexical order with `python scripts/run_migrations.py`. Run the service with `uvicorn src.api:app --reload`. The generated interactive OpenAPI contract is available at `/docs` while the service is running.
