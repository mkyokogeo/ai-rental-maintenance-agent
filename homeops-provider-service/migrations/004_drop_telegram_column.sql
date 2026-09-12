-- Drop channel-specific columns; this service is transport-agnostic

ALTER TABLE service_requests
    DROP COLUMN IF EXISTS telegram;

ALTER TABLE service_providers
    DROP COLUMN IF EXISTS contact_telegram;
