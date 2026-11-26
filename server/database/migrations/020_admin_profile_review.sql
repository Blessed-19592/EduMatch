BEGIN;

ALTER TABLE student_profiles
    ADD COLUMN profile_moderation_status VARCHAR(16) NOT NULL DEFAULT 'visible',
    ADD CONSTRAINT student_profile_moderation_status_check
        CHECK (profile_moderation_status IN ('visible', 'hidden'));

ALTER TABLE profile_review_history
    DROP CONSTRAINT profile_review_action_check,
    ADD CONSTRAINT profile_review_action_check
        CHECK (
            review_action IN (
                'submitted',
                'resubmitted',
                'approved',
                'changes_requested',
                'profile_hidden',
                'profile_restored'
            )
        );

CREATE INDEX idx_student_profiles_review_queue
    ON student_profiles (profile_submitted_at, user_id)
    WHERE profile_review_status = 'submitted';

CREATE INDEX idx_student_profiles_hidden
    ON student_profiles (updated_at DESC, user_id)
    WHERE profile_moderation_status = 'hidden';

COMMIT;
