BEGIN;

ALTER TABLE users
ADD COLUMN registration_number VARCHAR(50);

CREATE UNIQUE INDEX idx_users_registration_number
ON users(registration_number)
WHERE registration_number IS NOT NULL;

COMMIT;