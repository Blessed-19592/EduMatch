BEGIN;

ALTER TABLE email_verification_codes
ADD COLUMN registration_token_hash VARCHAR(64),
ADD COLUMN registration_token_expires_at TIMESTAMPTZ,
ADD COLUMN consumed_at TIMESTAMPTZ;

COMMIT;