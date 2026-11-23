BEGIN;

-- Allow a chat message to contain only one or more attachments.
ALTER TABLE chat_messages
    ALTER COLUMN message_content DROP NOT NULL;

ALTER TABLE chat_messages
    DROP CONSTRAINT chat_messages_message_content_check;

ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_content_length_check
    CHECK (
        message_content IS NULL
        OR LENGTH(TRIM(message_content)) BETWEEN 1 AND 5000
    );

CREATE TABLE chat_message_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    message_id UUID
        REFERENCES chat_messages(message_id) ON DELETE CASCADE,

    uploaded_by UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    storage_key UUID NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL
        CHECK (size_bytes BETWEEN 1 AND 10485760),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pending_expires_at TIMESTAMPTZ,

    CONSTRAINT chat_attachment_mime_type_check
        CHECK (
            mime_type IN (
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            )
        ),

    CONSTRAINT chat_attachment_pending_state_check
        CHECK (
            (message_id IS NULL AND pending_expires_at IS NOT NULL)
            OR
            (message_id IS NOT NULL AND pending_expires_at IS NULL)
        )
);

CREATE INDEX chat_message_attachments_message_idx
    ON chat_message_attachments(message_id, created_at)
    WHERE message_id IS NOT NULL;

CREATE INDEX chat_message_attachments_pending_idx
    ON chat_message_attachments(uploaded_by, group_id, pending_expires_at)
    WHERE message_id IS NULL;

CREATE OR REPLACE FUNCTION validate_chat_attachment_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.message_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM chat_messages cm
           JOIN chat_rooms cr ON cr.room_id = cm.room_id
           WHERE cm.message_id = NEW.message_id
             AND cr.group_id = NEW.group_id
             AND cm.sender_id = NEW.uploaded_by
       ) THEN
        RAISE EXCEPTION 'Attachment must belong to its sender and group message.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_chat_attachment_link
BEFORE INSERT OR UPDATE OF message_id, group_id, uploaded_by
ON chat_message_attachments
FOR EACH ROW
EXECUTE FUNCTION validate_chat_attachment_link();

CREATE OR REPLACE FUNCTION ensure_chat_message_has_content_or_attachment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM chat_messages cm
        WHERE cm.message_id = NEW.message_id
          AND cm.message_content IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM chat_message_attachments a
              WHERE a.message_id = cm.message_id
          )
    ) THEN
        RAISE EXCEPTION 'A chat message must contain text or an attachment.';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chat_message_requires_content_or_attachment
AFTER INSERT OR UPDATE OF message_content
ON chat_messages
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION ensure_chat_message_has_content_or_attachment();

CREATE OR REPLACE FUNCTION ensure_attachment_removal_preserves_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE')
       AND OLD.message_id IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM chat_messages cm
           WHERE cm.message_id = OLD.message_id
             AND cm.message_content IS NULL
             AND NOT EXISTS (
                 SELECT 1
                 FROM chat_message_attachments a
                 WHERE a.message_id = cm.message_id
             )
       ) THEN
        RAISE EXCEPTION 'An attachment-only message must retain an attachment.';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_chat_attachment_removal_preserves_message
AFTER UPDATE OR DELETE
ON chat_message_attachments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION ensure_attachment_removal_preserves_message();

COMMIT;
