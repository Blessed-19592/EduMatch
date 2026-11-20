BEGIN;

-- =====================================================
-- EDUMATCH MIGRATION 016
-- GROUP INVITATIONS
-- =====================================================

CREATE TABLE group_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL
        REFERENCES student_groups(group_id)
        ON DELETE CASCADE,

    inviter_id UUID NOT NULL
        REFERENCES student_profiles(user_id),

    invitee_id UUID NOT NULL
        REFERENCES student_profiles(user_id),

    message VARCHAR(1000),

    invitation_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            invitation_status IN (
                'pending',
                'accepted',
                'declined',
                'cancelled'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT different_invitation_participants
        CHECK (inviter_id <> invitee_id)
);


-- Prevent duplicate pending invitations
-- for the same student and group.

CREATE UNIQUE INDEX uq_group_invitations_pending
ON group_invitations(group_id, invitee_id)
WHERE invitation_status = 'pending';


-- Retrieve invitations received by a student.

CREATE INDEX idx_group_invitations_received
ON group_invitations(invitee_id, created_at DESC);


-- Retrieve invitations sent by a group owner.

CREATE INDEX idx_group_invitations_sent
ON group_invitations(inviter_id, created_at DESC);


-- Retrieve invitations belonging to a group.

CREATE INDEX idx_group_invitations_group
ON group_invitations(group_id, created_at DESC);


COMMIT;