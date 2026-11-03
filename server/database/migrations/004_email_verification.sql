BEGIN;

CREATE TABLE email_verification_codes (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    registry_student_id UUID NOT NULL
        REFERENCES registry_students(registry_student_id)
        ON DELETE CASCADE,

    code_hash VARCHAR(255) NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    attempts SMALLINT NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_student
ON email_verification_codes(registry_student_id);

COMMIT;