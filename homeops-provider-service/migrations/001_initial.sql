-- Initial schema: landlords, properties, service providers
-- Safe to re-run: uses IF NOT EXISTS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS landlords (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    company_name    TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id     UUID REFERENCES landlords(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    address_line1   TEXT,
    address_line2   TEXT,
    city            TEXT NOT NULL,
    region          TEXT,
    postal_code     TEXT,
    country         TEXT NOT NULL DEFAULT 'SE',
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    property_type   TEXT,
    units           INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_city ON properties (city);
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON properties (landlord_id);

CREATE TABLE IF NOT EXISTS service_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    category        TEXT,
    website         TEXT,
    email           TEXT,
    phone           TEXT,
    city            TEXT,
    region          TEXT,
    country         TEXT NOT NULL DEFAULT 'SE',
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    categories      TEXT[] NOT NULL DEFAULT '{}',
    brands          TEXT[] NOT NULL DEFAULT '{}',
    description     TEXT,
    source_url      TEXT,
    exa_score       DOUBLE PRECISION,
    rank_score      DOUBLE PRECISION,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_providers_city ON service_providers (city);
CREATE INDEX IF NOT EXISTS idx_service_providers_category ON service_providers (category);
CREATE INDEX IF NOT EXISTS idx_service_providers_rank_score ON service_providers (rank_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS property_providers (
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    provider_id     UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
    relationship    TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (property_id, provider_id)
);
