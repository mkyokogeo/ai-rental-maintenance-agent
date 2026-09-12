# System diagrams

These diagrams describe the current dispatch-only service. Provider discovery
is intentionally outside this application.

## System context

```mermaid
flowchart LR
    Tenant[Tenant] --> Agent[Telegram-facing agent]
    Agent -->|POST /match\nor POST /applications| API[HomeOps Provider Service]
    API -->|Read/write| DB[(PostgreSQL / Supabase)]
    Agent -->|Delivers action token| Provider[Service provider]
    Provider -->|POST /applications/:id/action| API
    API -->|Acceptance event, if configured| Webhook[Telegram-agent webhook]
    Webhook --> Agent
```

The agent handles conversation and delivery of the provider invitation. The
service handles matching, persistent application state, and secure provider
responses.

## Internal request path

```mermaid
flowchart TD
    Request[Validated FastAPI request] --> Residence[Residence lookup]
    Residence -->|Active tenant found| Match[Provider matcher]
    Residence -->|No active tenant| NotFound[404]
    Match -->|Eligible provider| Create[Create service request]
    Match -->|No category-qualified provider| Review[Create manual-review request]
    Create --> Attempt[Create provider attempt]
    Attempt --> Token[Issue signed 48-hour action token]
    Token --> Response[Return application and token]
    Review --> Response

    Action[Provider action request] --> Verify[Verify signature, expiry, token digest]
    Verify -->|Accept| Accepted[Mark attempt and application accepted]
    Verify -->|Decline| Alternative[Find untried eligible provider]
    Alternative -->|Found| Attempt
    Alternative -->|None| ReviewState[Mark application manual_review]
    Accepted --> Notify[Send optional acceptance webhook]
```

## Application state transitions

```mermaid
stateDiagram-v2
    [*] --> pending_provider: eligible provider selected
    [*] --> manual_review: no eligible provider

    pending_provider --> accepted: provider accepts
    pending_provider --> pending_provider: provider declines; next provider selected
    pending_provider --> manual_review: provider declines; no alternatives

    accepted --> [*]
    manual_review --> [*]
```

Each pending provider invitation has a matching
`service_request_provider_attempts` record. A provider can answer only its own
pending attempt, and one provider cannot be invited twice for the same
application.

## Data ownership

```mermaid
flowchart TB
    Landlord[landlords] --> Property[properties]
    Property --> Tenant[tenants]
    Property --> Request[service_requests]
    Tenant -. optional requester .-> Request
    Provider[service_providers] -. current assignee .-> Request
    Request --> Attempt[service_request_provider_attempts]
    Provider --> Attempt
    Property <-->|preferred relationship| Provider
```
