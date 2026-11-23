BEGIN;

CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY
        REFERENCES users(user_id) ON DELETE CASCADE,

    theme VARCHAR(8) NOT NULL DEFAULT 'light'
        CHECK (theme IN ('light', 'dark')),

    profile_discoverable BOOLEAN NOT NULL DEFAULT TRUE,

    notify_collaboration_requests BOOLEAN NOT NULL DEFAULT TRUE,
    notify_group_invitations BOOLEAN NOT NULL DEFAULT TRUE,
    notify_membership_updates BOOLEAN NOT NULL DEFAULT TRUE,
    notify_messages BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,

    actor_id UUID
        REFERENCES users(user_id) ON DELETE SET NULL,

    notification_type VARCHAR(32) NOT NULL
        CHECK (
            notification_type IN (
                'collaboration_request',
                'group_invitation',
                'membership_update',
                'group_message'
            )
        ),

    group_id UUID
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    entity_id UUID,

    target_page VARCHAR(32) NOT NULL
        CHECK (
            target_page IN (
                'Collaboration Requests',
                'Group Invitations',
                'Membership Requests',
                'Messages'
            )
        ),

    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ
);

CREATE INDEX user_notifications_recipient_created_idx
    ON user_notifications (recipient_id, created_at DESC);

CREATE INDEX user_notifications_unread_idx
    ON user_notifications (recipient_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION create_user_notification(
    p_recipient_id UUID,
    p_actor_id UUID,
    p_notification_type VARCHAR,
    p_group_id UUID,
    p_entity_id UUID,
    p_target_page VARCHAR,
    p_title VARCHAR,
    p_body TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    notifications_enabled BOOLEAN;
BEGIN
    IF p_recipient_id IS NULL OR p_recipient_id = p_actor_id THEN
        RETURN;
    END IF;

    SELECT CASE p_notification_type
        WHEN 'collaboration_request' THEN notify_collaboration_requests
        WHEN 'group_invitation' THEN notify_group_invitations
        WHEN 'membership_update' THEN notify_membership_updates
        WHEN 'group_message' THEN notify_messages
        ELSE FALSE
    END
    INTO notifications_enabled
    FROM user_settings
    WHERE user_id = p_recipient_id;

    IF NOT FOUND THEN
        notifications_enabled := TRUE;
    END IF;

    IF notifications_enabled IS DISTINCT FROM TRUE THEN
        RETURN;
    END IF;

    INSERT INTO user_notifications (
        recipient_id,
        actor_id,
        notification_type,
        group_id,
        entity_id,
        target_page,
        title,
        body
    )
    VALUES (
        p_recipient_id,
        p_actor_id,
        p_notification_type,
        p_group_id,
        p_entity_id,
        p_target_page,
        p_title,
        p_body
    );
END;
$$;

CREATE OR REPLACE FUNCTION notify_student_collaboration_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    actor_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT full_name INTO actor_name
        FROM users
        WHERE user_id = NEW.sender_id;

        PERFORM create_user_notification(
            NEW.recipient_id,
            NEW.sender_id,
            'collaboration_request',
            NULL,
            NEW.request_id,
            'Collaboration Requests',
            'New collaboration request',
            format('%s sent you a collaboration request.', actor_name)
        );
    ELSIF OLD.request_status = 'pending'
       AND NEW.request_status IN ('accepted', 'declined') THEN
        SELECT full_name INTO actor_name
        FROM users
        WHERE user_id = NEW.recipient_id;

        PERFORM create_user_notification(
            NEW.sender_id,
            NEW.recipient_id,
            'collaboration_request',
            NULL,
            NEW.request_id,
            'Collaboration Requests',
            'Collaboration request updated',
            format('%s %s your collaboration request.',
                actor_name,
                NEW.request_status
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER student_collaboration_request_notifications
AFTER INSERT OR UPDATE OF request_status
ON student_collaboration_requests
FOR EACH ROW
EXECUTE FUNCTION notify_student_collaboration_request();

CREATE OR REPLACE FUNCTION notify_group_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    actor_name TEXT;
    group_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT full_name INTO actor_name
        FROM users
        WHERE user_id = NEW.inviter_id;

        SELECT sg.group_name INTO group_name
        FROM student_groups sg
        WHERE sg.group_id = NEW.group_id;

        PERFORM create_user_notification(
            NEW.invitee_id,
            NEW.inviter_id,
            'group_invitation',
            NEW.group_id,
            NEW.invitation_id,
            'Group Invitations',
            'New group invitation',
            format('%s invited you to join %s.', actor_name, group_name)
        );
    ELSIF OLD.invitation_status = 'pending'
       AND NEW.invitation_status IN ('accepted', 'declined') THEN
        SELECT full_name INTO actor_name
        FROM users
        WHERE user_id = NEW.invitee_id;

        SELECT sg.group_name INTO group_name
        FROM student_groups sg
        WHERE sg.group_id = NEW.group_id;

        PERFORM create_user_notification(
            NEW.inviter_id,
            NEW.invitee_id,
            'membership_update',
            NEW.group_id,
            NEW.invitation_id,
            'Group Invitations',
            'Group invitation updated',
            format('%s %s the invitation to %s.',
                actor_name,
                NEW.invitation_status,
                group_name
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER group_invitation_notifications
AFTER INSERT OR UPDATE OF invitation_status
ON group_invitations
FOR EACH ROW
EXECUTE FUNCTION notify_group_invitation();

CREATE OR REPLACE FUNCTION notify_group_membership_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    actor_id UUID;
    actor_name TEXT;
    group_name TEXT;
BEGIN
    SELECT sg.created_by, sg.group_name
    INTO actor_id, group_name
    FROM student_groups sg
    WHERE sg.group_id = NEW.group_id;

    IF TG_OP = 'INSERT' THEN
        SELECT full_name INTO actor_name
        FROM users
        WHERE user_id = NEW.student_id;

        PERFORM create_user_notification(
            actor_id,
            NEW.student_id,
            'membership_update',
            NEW.group_id,
            NEW.request_id,
            'Membership Requests',
            'New group membership request',
            format('%s requested to join %s.', actor_name, group_name)
        );
    ELSIF OLD.request_status = 'pending'
       AND NEW.request_status IN ('accepted', 'rejected') THEN
        SELECT full_name INTO actor_name
        FROM users
        WHERE user_id = actor_id;

        PERFORM create_user_notification(
            NEW.student_id,
            actor_id,
            'membership_update',
            NEW.group_id,
            NEW.request_id,
            'Membership Requests',
            'Membership request updated',
            format('%s %s your request to join %s.',
                actor_name,
                NEW.request_status,
                group_name
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER group_membership_request_notifications
AFTER INSERT OR UPDATE OF request_status
ON collaboration_requests
FOR EACH ROW
EXECUTE FUNCTION notify_group_membership_request();

CREATE OR REPLACE FUNCTION notify_group_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    recipient RECORD;
    notification_group_id UUID;
    group_name TEXT;
    actor_name TEXT;
BEGIN
    SELECT sg.group_id, sg.group_name
    INTO notification_group_id, group_name
    FROM chat_rooms cr
    JOIN student_groups sg ON sg.group_id = cr.group_id
    WHERE cr.room_id = NEW.room_id;

    SELECT full_name INTO actor_name
    FROM users
    WHERE user_id = NEW.sender_id;

    FOR recipient IN
        SELECT gm.student_id
        FROM group_members gm
        WHERE gm.group_id = notification_group_id
          AND gm.student_id <> NEW.sender_id
          AND gm.membership_status = 'active'
    LOOP
        PERFORM create_user_notification(
            recipient.student_id,
            NEW.sender_id,
            'group_message',
            notification_group_id,
            NEW.message_id,
            'Messages',
            format('New message in %s', group_name),
            format('%s sent a message in %s.', actor_name, group_name)
        );
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER group_message_notifications
AFTER INSERT
ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_group_message();

COMMIT;
