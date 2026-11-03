BEGIN;

ALTER TABLE registry_students
ADD COLUMN IF NOT EXISTS verification_email VARCHAR(255);

UPDATE registry_students
SET verification_email = 'tinasmith756018@gmail.com'
WHERE verification_email IS NULL;

COMMIT;