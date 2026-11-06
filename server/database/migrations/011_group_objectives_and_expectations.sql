BEGIN;

-- Add structured planning information to student groups.
ALTER TABLE student_groups
    ADD COLUMN objectives TEXT,
    ADD COLUMN expected_deliverables TEXT,
    ADD COLUMN member_responsibilities TEXT,
    ADD COLUMN member_expectations TEXT;

-- Prevent excessively long entries.
ALTER TABLE student_groups
    ADD CONSTRAINT student_groups_objectives_length_check
        CHECK (objectives IS NULL OR char_length(objectives) <= 5000),

    ADD CONSTRAINT student_groups_deliverables_length_check
        CHECK (expected_deliverables IS NULL OR char_length(expected_deliverables) <= 5000),

    ADD CONSTRAINT student_groups_responsibilities_length_check
        CHECK (member_responsibilities IS NULL OR char_length(member_responsibilities) <= 5000),

    ADD CONSTRAINT student_groups_expectations_length_check
        CHECK (member_expectations IS NULL OR char_length(member_expectations) <= 5000);

COMMENT ON COLUMN student_groups.objectives
    IS 'What the group intends to achieve.';

COMMENT ON COLUMN student_groups.expected_deliverables
    IS 'Expected outputs or results of the collaboration.';

COMMENT ON COLUMN student_groups.member_responsibilities
    IS 'Responsibilities expected of group members.';

COMMENT ON COLUMN student_groups.member_expectations
    IS 'Working expectations and commitments for group members.';

COMMIT;