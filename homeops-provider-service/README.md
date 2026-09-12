# HomeOps Provider Service

FastAPI service that routes a tenant's maintenance issue to a suitable service provider. It uses PostgreSQL (including Supabase) for operational state.

Start with the detailed guides:

- [Architecture and request lifecycle](docs/architecture.md)
- [Database and API schemas](docs/schemas.md)
- [System diagrams](docs/diagrams.md)

## Setup

1. Create one shared Supabase project for the team.
2. In Supabase: **Project → Connect → Session pooler** (port `5432` — best for IPv4-only networks / laptops).
3. Copy credentials into `.env` (never commit this file):

```bash
cp .env.example .env
# Edit .env with your pooler URL
```

Example shape (do not commit real values):

```
DATABASE_URL="postgresql://postgres.PROJECT_ID:PASSWORD@....pooler.supabase.com:5432/postgres"
```

4. Create a virtualenv and install deps:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Database

Apply the ordered migrations (no `DROP` / `TRUNCATE` / `DELETE` without explicit approval):

```bash
cat migrations/001_initial.sql
python scripts/run_migrations.py
```

Smoke-test connectivity (does not print `DATABASE_URL`):

```bash
python scripts/inspect_db.py
```

Optional demo rows:

```bash
python scripts/seed_demo.py
```

If you have `psql`:

```bash
psql "$DATABASE_URL"
# SELECT now();
# SELECT * FROM properties LIMIT 10;
```

On macOS: `brew install libpq && brew link --force libpq`  
On Ubuntu/Debian: `sudo apt install postgresql-client`

## Run the API

`POST /match` previews a non-persistent match. `POST /applications` creates a repair request and returns a one-time provider action token for the calling agent to deliver to the provider.

### Provider discovery for new cities

Before its first match for a city that has no provider records, HomeOps calls the
specialist discovery service and then retries the match against the providers it
saved. By default the service calls:

```text
https://huff-dastardly-shawl.ngrok-free.dev/specialists
```

It sends `POST` JSON in the form `{"city":"Valencia"}`. Set
`SPECIALIST_DISCOVERY_URL` to use another deployment and
`SPECIALIST_DISCOVERY_TIMEOUT_SECONDS` (default: `120`) to tune the request
timeout. A discovery failure returns `503` rather than silently creating a
manual-review request. The `/match` response includes `discovery_triggered` so
callers can tell when a new-city lookup occurred.

### Run it

```bash
uvicorn src.api:app --reload
```

In a second terminal, seed the demo records once:

```bash
python scripts/run_migrations.py
python scripts/seed_demo.py
```

### `POST /applications`

```bash
curl -X POST http://127.0.0.1:8000/applications \
  -H 'Content-Type: application/json' \
  -d '{
    "telegram_id": "10001",
    "categories": ["appliance_repair"],
    "brands": ["Bosch"],
    "summary": "My washing machine does not start",
    "urgency": "normal",
    "findings": {"appliance": "washing_machine"}
  }'
```

The response contains an `application` object plus a `provider_action` object.
The calling agent uses that action token when it sends the provider's email.
Category and brand tags are case-insensitive. If no provider explicitly
supports a requested category, the application is created as `manual_review`;
it never assigns a random provider.

### Provider acceptance or decline

Use this GET URL as the provider's email acceptance button. Opening it accepts
the pending invitation directly:

```text
http://127.0.0.1:8000/applications/APPLICATION_ID/action?token=TOKEN_FROM_provider_action
```

The token is signed, expires after 48 hours, and is consumed after the first
successful response. Keep the existing POST endpoint for a decline (including
an optional reason):

```bash
curl -X POST "http://127.0.0.1:8000/applications/APPLICATION_ID/action" \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "TOKEN_FROM_provider_action",
    "decision": "decline",
    "decline_reason": "Unavailable this week"
  }'
```

The service marks that invitation declined, tries the next category-matched
mechanic, and emits `application.reassigned`. When no alternative exists it emits
`application.manual_review_required`.

### Telegram-agent webhook

Set `TELEGRAM_AGENT_WEBHOOK_URL` in `.env`. The connected Telegram endpoint
is notified only when the provider accepts. It receives:

The body has this shape:

```json
{
  "event": "technician_task_accepted",
  "incident_id": "APPLICATION_UUID",
  "tenant_telegram_id": "10001",
  "landlord_telegram_id": "20001",
  "technician": {
    "id": "TECHNICIAN_UUID",
    "name": "Technician Name",
    "telegram_id": "30001",
    "phone": "+15551234567",
    "email": "technician@example.com"
  },
  "message": "The technician has accepted the maintenance request."
}
```

The service uses the application UUID as `incident_id`. To enable webhook
signing later, set `TELEGRAM_AGENT_WEBHOOK_SECRET`. It then sends
`X-HomeOps-Timestamp` and `X-HomeOps-Signature`, where the signature is:

```text
HMAC-SHA256(webhook_secret, timestamp + "." + raw_request_body)
```

`GET /health` is included only as a deployment health check.

## Security notes

- Keep direct database credentials secret; prefer SSL (Supabase pooler uses SSL).
- Do not paste `DATABASE_URL` or passwords into chat — load them from `.env` via `src/db.py`.
- Agents / Codex should use `DATABASE_URL` from the environment only.
