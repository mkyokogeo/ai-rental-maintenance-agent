-- Work orders created when a caller requests an engineer match

CREATE TABLE IF NOT EXISTS service_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status              TEXT NOT NULL DEFAULT 'assigned',
    summary             TEXT NOT NULL,
    categories          TEXT[] NOT NULL DEFAULT '{}',
    brands              TEXT[] NOT NULL DEFAULT '{}',
    city                TEXT,
    country             TEXT,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    property_id         UUID REFERENCES properties(id) ON DELETE SET NULL,
    property_address    TEXT,
    apartment           TEXT,
    urgency             TEXT NOT NULL DEFAULT 'normal',
    findings            JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_id         UUID REFERENCES service_providers(id) ON DELETE SET NULL,
    match_score         DOUBLE PRECISION,
    match_reasons       TEXT[] NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests (status);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id ON service_requests (provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests (created_at DESC);
