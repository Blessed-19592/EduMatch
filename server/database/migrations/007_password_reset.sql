BEGIN;

CREATE TABLE password_reset_tokens (
    reset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    token_hash VARCHAR(64) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user
ON password_reset_tokens(user_id);

CREATE INDEX idx_password_reset_expiry
ON password_reset_tokens(expires_at);

COMMIT;