-- Each mechanic invitation is retained so declines can safely move to another provider.

CREATE TABLE IF NOT EXISTS service_request_provider_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_request_id  UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    provider_id         UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending',
    action_token_hash   TEXT NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    decline_reason      TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (service_request_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_attempts_request
    ON service_request_provider_attempts (service_request_id);
