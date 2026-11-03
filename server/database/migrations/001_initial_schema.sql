-- ==========================================
-- EDUMATCH DATABASE
-- Initial Database Schema
-- ==========================================

-- ==========================================
-- 1. USERS
-- Students and administrators
-- ==========================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'admin')),

    account_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'suspended')),

    email_verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX users_email_unique
ON users (LOWER(email));


-- ==========================================
-- 2. STUDENT PROFILES
-- ==========================================

CREATE TABLE student_profiles (
    user_id UUID PRIMARY KEY
        REFERENCES users(user_id) ON DELETE CASCADE,

    institution VARCHAR(200),
    course VARCHAR(150),
    year_of_study SMALLINT
        CHECK (year_of_study BETWEEN 1 AND 10),

    bio TEXT,
    profile_picture_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 3. SKILLS
-- ==========================================

CREATE TABLE skills (
    skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    skill_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 4. STUDENT SKILLS
-- Many-to-many relationship
-- ==========================================

CREATE TABLE student_skills (
    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    skill_id UUID NOT NULL
        REFERENCES skills(skill_id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (student_id, skill_id)
);


-- ==========================================
-- 5. PORTFOLIOS
-- GitHub projects and other work
-- ==========================================

CREATE TABLE portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    title VARCHAR(150) NOT NULL,
    description TEXT,

    repository_url TEXT NOT NULL,
    live_demo_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 6. STUDENT GROUPS
-- ==========================================

CREATE TABLE student_groups (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_name VARCHAR(150) NOT NULL,
    description TEXT,

    created_by UUID NOT NULL
        REFERENCES student_profiles(user_id),

    max_members SMALLINT NOT NULL DEFAULT 5
        CHECK (max_members BETWEEN 2 AND 20),

    group_status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (group_status IN ('open', 'full', 'closed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 7. GROUP MEMBERS
-- ==========================================

CREATE TABLE group_members (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id),

    membership_role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (membership_role IN ('owner', 'member')),

    membership_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('active', 'left', 'removed')),

    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (group_id, membership_id)
);

-- Prevent duplicate active memberships.
CREATE UNIQUE INDEX unique_active_group_membership
ON group_members (group_id, student_id)
WHERE membership_status = 'active';


-- ==========================================
-- 8. GROUP REQUIRED SKILLS
-- Skills a group is looking for
-- ==========================================

CREATE TABLE group_required_skills (
    group_id UUID NOT NULL
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    skill_id UUID NOT NULL
        REFERENCES skills(skill_id) ON DELETE CASCADE,

    PRIMARY KEY (group_id, skill_id)
);


-- ==========================================
-- 9. COLLABORATION REQUESTS
-- ==========================================

CREATE TABLE collaboration_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    message TEXT,

    request_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            request_status IN (
                'pending',
                'accepted',
                'rejected',
                'cancelled'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Prevent multiple pending requests from the same student.
CREATE UNIQUE INDEX unique_pending_collaboration_request
ON collaboration_requests (group_id, student_id)
WHERE request_status = 'pending';


-- ==========================================
-- 10. MATCH RECOMMENDATIONS
-- ==========================================

CREATE TABLE match_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    recommended_user_id UUID
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    recommended_group_id UUID
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    match_score NUMERIC(5,2) NOT NULL
        CHECK (match_score BETWEEN 0 AND 100),

    match_reasons JSONB NOT NULL DEFAULT '[]'::JSONB,

    recommendation_status VARCHAR(20) NOT NULL DEFAULT 'suggested'
        CHECK (
            recommendation_status IN (
                'suggested',
                'dismissed',
                'acted_on'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (recommended_user_id IS NOT NULL AND recommended_group_id IS NULL)
        OR
        (recommended_user_id IS NULL AND recommended_group_id IS NOT NULL)
    ),

    CHECK (recommended_user_id IS NULL OR recommended_user_id <> student_id)
);

CREATE INDEX match_recommendations_student_idx
ON match_recommendations (student_id, created_at DESC);


-- ==========================================
-- 11. CHAT ROOMS
-- One chat room per group
-- ==========================================

CREATE TABLE chat_rooms (
    room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL UNIQUE
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 12. CHAT MESSAGES
-- ==========================================

CREATE TABLE chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    room_id UUID NOT NULL
        REFERENCES chat_rooms(room_id) ON DELETE CASCADE,

    sender_id UUID NOT NULL
        REFERENCES student_profiles(user_id),

    message_content TEXT NOT NULL
        CHECK (
            LENGTH(TRIM(message_content)) BETWEEN 1 AND 5000
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX chat_messages_room_time_idx
ON chat_messages (room_id, created_at);


-- ==========================================
-- 13. GROUP TASKS
-- ==========================================

CREATE TABLE group_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID NOT NULL
        REFERENCES student_groups(group_id) ON DELETE CASCADE,

    task_title VARCHAR(200) NOT NULL,
    description TEXT,

    assigned_to UUID
        REFERENCES student_profiles(user_id),

    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),

    task_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            task_status IN (
                'pending',
                'in_progress',
                'completed'
            )
        ),

    due_date TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 14. TASK PROGRESS HISTORY
-- ==========================================

CREATE TABLE task_progress (
    progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    task_id UUID NOT NULL
        REFERENCES group_tasks(task_id) ON DELETE CASCADE,

    changed_by UUID NOT NULL
        REFERENCES student_profiles(user_id),

    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,

    progress_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 15. REPORTS
-- ==========================================

CREATE TABLE reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reported_by UUID NOT NULL
        REFERENCES users(user_id),

    target_user_id UUID
        REFERENCES users(user_id),

    target_group_id UUID
        REFERENCES student_groups(group_id),

    target_message_id UUID
        REFERENCES chat_messages(message_id),

    reason VARCHAR(100) NOT NULL,
    description TEXT,

    report_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            report_status IN (
                'pending',
                'reviewing',
                'resolved',
                'dismissed'
            )
        ),

    reviewed_by UUID
        REFERENCES users(user_id),

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        num_nonnulls(
            target_user_id,
            target_group_id,
            target_message_id
        ) = 1
    )
);


-- ==========================================
-- 16. ADMIN AUDIT LOGS
-- ==========================================

CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    actor_id UUID
        REFERENCES users(user_id) ON DELETE SET NULL,

    action VARCHAR(150) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,

    details JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 17. AUTOMATIC UPDATED_AT TIMESTAMPS
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER student_profiles_updated_at
BEFORE UPDATE ON student_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER portfolios_updated_at
BEFORE UPDATE ON portfolios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER student_groups_updated_at
BEFORE UPDATE ON student_groups
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER collaboration_requests_updated_at
BEFORE UPDATE ON collaboration_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER group_tasks_updated_at
BEFORE UPDATE ON group_tasks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ==========================================
-- END OF INITIAL SCHEMA
-- ==========================================