-- Extend service_providers for demo technician seeding
-- Safe to re-run: ADD COLUMN IF NOT EXISTS

ALTER TABLE service_providers
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS brands TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_service_providers_categories
    ON service_providers USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_service_providers_brands
    ON service_providers USING GIN (brands);
