-- Occupancy + Telegram contact IDs for shared DB

ALTER TABLE landlords
    ADD COLUMN IF NOT EXISTS telegram_id TEXT;

ALTER TABLE service_providers
    ADD COLUMN IF NOT EXISTS telegram_id TEXT;

CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    telegram_id     TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    moved_in_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    moved_out_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_active_telegram
    ON tenants (telegram_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tenants_property_id ON tenants (property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_telegram_id ON tenants (telegram_id);

ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS requester_telegram_id TEXT,
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
