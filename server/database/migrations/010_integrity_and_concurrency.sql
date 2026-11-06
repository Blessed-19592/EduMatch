BEGIN;

-- =====================================================
-- EDUMATCH MIGRATION 010
-- Integrity, concurrency and access protection
-- =====================================================


-- 1. PRE-FLIGHT VALIDATION
-- =====================================================

DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM group_members
        WHERE membership_status = 'active'
        GROUP BY group_id, student_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Duplicate active group memberships detected.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM group_members
        WHERE membership_role = 'owner'
          AND membership_status = 'active'
        GROUP BY group_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Groups with multiple active owners detected.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM collaboration_requests
        WHERE request_status = 'pending'
        GROUP BY group_id, student_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Duplicate pending collaboration requests detected.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM match_recommendations
        WHERE recommended_user_id IS NOT NULL
        GROUP BY student_id, recommended_user_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Duplicate user recommendations detected.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM match_recommendations
        WHERE recommended_group_id IS NOT NULL
        GROUP BY student_id, recommended_group_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Duplicate group recommendations detected.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM task_progress
        WHERE new_status NOT IN (
            'pending', 'in_progress', 'completed'
        )
        OR (
            previous_status IS NOT NULL
            AND previous_status NOT IN (
                'pending', 'in_progress', 'completed'
            )
        )
    ) THEN
        RAISE EXCEPTION
            'Unsupported task progress statuses detected.';
    END IF;

END;
$$;


-- 2. MEMBERSHIP UNIQUENESS
-- =====================================================

CREATE UNIQUE INDEX uq_group_members_active
ON group_members(group_id, student_id)
WHERE membership_status = 'active';


CREATE UNIQUE INDEX uq_group_one_active_owner
ON group_members(group_id)
WHERE membership_role = 'owner'
  AND membership_status = 'active';


-- 3. PENDING REQUEST UNIQUENESS
-- =====================================================

CREATE UNIQUE INDEX uq_collaboration_requests_pending
ON collaboration_requests(group_id, student_id)
WHERE request_status = 'pending';


-- 4. MATCH RECOMMENDATION UNIQUENESS
-- =====================================================

CREATE UNIQUE INDEX uq_match_recommendations_user
ON match_recommendations(student_id, recommended_user_id)
WHERE recommended_user_id IS NOT NULL;


CREATE UNIQUE INDEX uq_match_recommendations_group
ON match_recommendations(student_id, recommended_group_id)
WHERE recommended_group_id IS NOT NULL;


-- 5. MEMBERSHIP CONCURRENCY PROTECTION
-- =====================================================

CREATE OR REPLACE FUNCTION protect_group_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_group_id UUID;
    v_max_members INTEGER;
    v_group_status VARCHAR;
    v_active_count INTEGER;
BEGIN

    IF TG_OP = 'DELETE' THEN
        v_group_id := OLD.group_id;

    ELSE
        v_group_id := NEW.group_id;
    END IF;

    -- Membership identity must not be changed.
    IF TG_OP = 'UPDATE' THEN

        IF NEW.group_id <> OLD.group_id
           OR NEW.student_id <> OLD.student_id THEN

            RAISE EXCEPTION
                'Membership group and student cannot be changed.';

        END IF;

    END IF;

    -- Serialize membership changes for this group.
    SELECT max_members, group_status
    INTO v_max_members, v_group_status
    FROM student_groups
    WHERE group_id = v_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Group does not exist.';
    END IF;

    -- Deletions only need the lock.
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    IF NEW.membership_status <> 'active' THEN
        RETURN NEW;
    END IF;

    -- Validate ownership.
    IF NEW.membership_role = 'owner'
       AND NEW.student_id <> (
           SELECT created_by
           FROM student_groups
           WHERE group_id = v_group_id
       ) THEN

        RAISE EXCEPTION
            'Only the group creator can be its owner.';

    END IF;

    -- Do not reject updates that leave an already-active
    -- member active, such as a role change.
    IF TG_OP = 'UPDATE'
       AND OLD.membership_status = 'active' THEN
        RETURN NEW;
    END IF;

    -- Closed groups cannot accept new members.
    -- The creator can still be registered as owner.
    IF v_group_status <> 'open'
       AND NEW.membership_role <> 'owner' THEN

        RAISE EXCEPTION
            'This group is not accepting new members.';

    END IF;

    SELECT COUNT(*)
    INTO v_active_count
    FROM group_members
    WHERE group_id = v_group_id
      AND membership_status = 'active';

    IF v_active_count >= v_max_members THEN
        RAISE EXCEPTION
            'The group has reached its member limit.';
    END IF;

    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_protect_group_membership
BEFORE INSERT OR UPDATE OR DELETE
ON group_members
FOR EACH ROW
EXECUTE FUNCTION protect_group_membership();


-- 6. AUTOMATIC GROUP OWNER CREATION
-- =====================================================

CREATE OR REPLACE FUNCTION create_group_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    INSERT INTO group_members (
        group_id,
        student_id,
        membership_role,
        membership_status
    )
    VALUES (
        NEW.group_id,
        NEW.created_by,
        'owner',
        'active'
    );

    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_create_group_owner
AFTER INSERT ON student_groups
FOR EACH ROW
EXECUTE FUNCTION create_group_owner_membership();


-- 7. AUTOMATIC GROUP CAPACITY STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_group_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_group_id UUID;
    v_max_members INTEGER;
    v_group_status VARCHAR;
    v_active_count INTEGER;
BEGIN

    IF TG_OP = 'DELETE' THEN
        v_group_id := OLD.group_id;
    ELSE
        v_group_id := NEW.group_id;
    END IF;

    SELECT max_members, group_status
    INTO v_max_members, v_group_status
    FROM student_groups
    WHERE group_id = v_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*)
    INTO v_active_count
    FROM group_members
    WHERE group_id = v_group_id
      AND membership_status = 'active';

    IF v_group_status <> 'closed' THEN

        UPDATE student_groups
        SET group_status =
            CASE
                WHEN v_active_count >= v_max_members
                    THEN 'full'
                ELSE 'open'
            END
        WHERE group_id = v_group_id;

    END IF;

    RETURN NULL;

END;
$$;


CREATE TRIGGER trg_refresh_group_status
AFTER INSERT OR UPDATE OF membership_status OR DELETE
ON group_members
FOR EACH ROW
EXECUTE FUNCTION refresh_group_status();


-- 8. TASK ASSIGNMENT PROTECTION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.assigned_to IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM 1
    FROM student_groups
    WHERE group_id = NEW.group_id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM group_members
        WHERE group_id = NEW.group_id
          AND student_id = NEW.assigned_to
          AND membership_status = 'active'
    ) THEN

        RAISE EXCEPTION
            'Task assignee must be an active group member.';

    END IF;

    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_validate_task_assignment
BEFORE INSERT OR UPDATE OF group_id, assigned_to
ON group_tasks
FOR EACH ROW
EXECUTE FUNCTION validate_task_assignment();


-- 9. GROUP CHAT MEMBERSHIP PROTECTION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_chat_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_group_id UUID;
BEGIN

    SELECT group_id
    INTO v_group_id
    FROM chat_rooms
    WHERE room_id = NEW.room_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chat room does not exist.';
    END IF;

    PERFORM 1
    FROM student_groups
    WHERE group_id = v_group_id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM group_members
        WHERE group_id = v_group_id
          AND student_id = NEW.sender_id
          AND membership_status = 'active'
    ) THEN

        RAISE EXCEPTION
            'Only active group members can send messages.';

    END IF;

    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_validate_chat_membership
BEFORE INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION validate_chat_membership();


-- 10. TASK PROGRESS VALIDATION
-- =====================================================

ALTER TABLE task_progress
ADD CONSTRAINT task_progress_new_status_check
CHECK (
    new_status IN (
        'pending',
        'in_progress',
        'completed'
    )
);


ALTER TABLE task_progress
ADD CONSTRAINT task_progress_previous_status_check
CHECK (
    previous_status IS NULL
    OR previous_status IN (
        'pending',
        'in_progress',
        'completed'
    )
);


CREATE OR REPLACE FUNCTION validate_task_progress_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_group_id UUID;
BEGIN

    SELECT group_id
    INTO v_group_id
    FROM group_tasks
    WHERE task_id = NEW.task_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task does not exist.';
    END IF;

    PERFORM 1
    FROM student_groups
    WHERE group_id = v_group_id
    FOR UPDATE;

    IF NOT EXISTS (
        SELECT 1
        FROM group_members
        WHERE group_id = v_group_id
          AND student_id = NEW.changed_by
          AND membership_status = 'active'
    ) THEN

        RAISE EXCEPTION
            'Only active group members can record task progress.';

    END IF;

    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_validate_task_progress_member
BEFORE INSERT ON task_progress
FOR EACH ROW
EXECUTE FUNCTION validate_task_progress_member();


-- 11. PERFORMANCE INDEXES
-- =====================================================

CREATE INDEX idx_group_members_student_active
ON group_members(student_id, group_id)
WHERE membership_status = 'active';


CREATE INDEX idx_group_tasks_group_status
ON group_tasks(group_id, task_status);


CREATE INDEX idx_chat_messages_room_created
ON chat_messages(room_id, created_at);


CREATE INDEX idx_collaboration_requests_student_status
ON collaboration_requests(student_id, request_status);


CREATE INDEX idx_task_progress_task_created
ON task_progress(task_id, created_at);


COMMIT;