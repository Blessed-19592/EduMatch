-- Direct student-to-student collaboration requests

CREATE TABLE student_collaboration_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sender_id UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    recipient_id UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    message TEXT NOT NULL
        CHECK (char_length(trim(message)) BETWEEN 10 AND 1000),

    request_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            request_status IN (
                'pending',
                'accepted',
                'declined',
                'cancelled'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT different_collaboration_participants
        CHECK (sender_id <> recipient_id)
);

-- Prevent duplicate pending requests between two students,
-- regardless of who initiated the request.
CREATE UNIQUE INDEX unique_pending_student_collaboration
ON student_collaboration_requests (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id)
)
WHERE request_status = 'pending';

CREATE INDEX idx_received_collaboration_requests
ON student_collaboration_requests (recipient_id, created_at DESC);

CREATE INDEX idx_sent_collaboration_requests
ON student_collaboration_requests (sender_id, created_at DESC);