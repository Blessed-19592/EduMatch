BEGIN;

-- =====================================================
-- 1. STUDENT COLLABORATION STATUS AND AVAILABILITY
-- =====================================================

ALTER TABLE student_profiles

ADD COLUMN collaboration_status VARCHAR(30)
    NOT NULL DEFAULT 'available',

ADD COLUMN availability_hours_per_week SMALLINT,

ADD COLUMN preferred_meeting_mode VARCHAR(20)
    NOT NULL DEFAULT 'any',

ADD COLUMN preferred_meeting_times JSONB
    NOT NULL DEFAULT '[]'::jsonb,

ADD COLUMN commitment_level VARCHAR(20)
    NOT NULL DEFAULT 'flexible',

ADD CONSTRAINT student_collaboration_status_check
CHECK (
    collaboration_status IN (
        'available',
        'currently_collaborating',
        'unavailable'
    )
),

ADD CONSTRAINT student_availability_hours_check
CHECK (
    availability_hours_per_week IS NULL
    OR availability_hours_per_week BETWEEN 1 AND 168
),

ADD CONSTRAINT student_meeting_mode_check
CHECK (
    preferred_meeting_mode IN (
        'remote',
        'in_person',
        'hybrid',
        'any'
    )
),

ADD CONSTRAINT student_meeting_times_array_check
CHECK (
    jsonb_typeof(preferred_meeting_times) = 'array'
),

ADD CONSTRAINT student_commitment_level_check
CHECK (
    commitment_level IN (
        'flexible',
        'moderate',
        'high'
    )
);


-- =====================================================
-- 2. INTEREST CATALOGUE
-- =====================================================

CREATE TABLE interests (
    interest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interest_name VARCHAR(150) NOT NULL UNIQUE,

    interest_category VARCHAR(50) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT interests_category_check
    CHECK (
        interest_category IN (
            'academic',
            'technical',
            'creative',
            'professional',
            'research',
            'personal',
            'other'
        )
    )
);


-- Students can have multiple interests.

CREATE TABLE student_interests (
    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id)
        ON DELETE CASCADE,

    interest_id UUID NOT NULL
        REFERENCES interests(interest_id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (student_id, interest_id)
);


-- =====================================================
-- 3. COLLABORATION TYPES
-- =====================================================

CREATE TABLE collaboration_types (
    collaboration_type_id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    type_code VARCHAR(50) NOT NULL UNIQUE,

    type_name VARCHAR(120) NOT NULL UNIQUE,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


INSERT INTO collaboration_types
    (type_code, type_name, description)
VALUES
(
    'STUDY_GROUP',
    'Study Group',
    'Students learn and practise together.'
),
(
    'PEER_LEARNING',
    'Peer Learning Partnership',
    'Students support each other in developing knowledge and skills.'
),
(
    'COURSEWORK_TEAM',
    'Coursework Team',
    'Students work together on academic assignments.'
),
(
    'PROJECT_TEAM',
    'Project Team',
    'Students jointly develop projects and practical solutions.'
),
(
    'RESEARCH_TEAM',
    'Research Team',
    'Students collaborate on research and investigations.'
),
(
    'INTERDISCIPLINARY_TEAM',
    'Interdisciplinary Team',
    'Students from different disciplines combine their expertise.'
);


-- Students can express interest in multiple types.

CREATE TABLE student_collaboration_types (
    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id)
        ON DELETE CASCADE,

    collaboration_type_id UUID NOT NULL
        REFERENCES collaboration_types(collaboration_type_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (student_id, collaboration_type_id)
);


-- Every group can have a specific collaboration type.

ALTER TABLE student_groups
ADD COLUMN collaboration_type_id UUID
REFERENCES collaboration_types(collaboration_type_id);

CREATE INDEX idx_groups_collaboration_type
ON student_groups(collaboration_type_id);


-- =====================================================
-- 4. PREFERRED TEAMMATE CHARACTERISTICS
-- =====================================================

CREATE TABLE student_partner_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL UNIQUE
        REFERENCES student_profiles(user_id)
        ON DELETE CASCADE,

    preferred_experience_level VARCHAR(30)
        NOT NULL DEFAULT 'any',

    preferred_commitment_level VARCHAR(20)
        NOT NULL DEFAULT 'any',

    preferred_working_style VARCHAR(30)
        NOT NULL DEFAULT 'any',

    additional_preferences TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT partner_experience_check
    CHECK (
        preferred_experience_level IN (
            'beginner',
            'intermediate',
            'advanced',
            'expert',
            'any'
        )
    ),

    CONSTRAINT partner_commitment_check
    CHECK (
        preferred_commitment_level IN (
            'flexible',
            'moderate',
            'high',
            'any'
        )
    ),

    CONSTRAINT partner_working_style_check
    CHECK (
        preferred_working_style IN (
            'independent',
            'collaborative',
            'structured',
            'flexible',
            'any'
        )
    )
);


-- Preferred teammate skills.

CREATE TABLE preferred_partner_skills (
    preference_id UUID NOT NULL
        REFERENCES student_partner_preferences(preference_id)
        ON DELETE CASCADE,

    skill_id UUID NOT NULL
        REFERENCES skills(skill_id),

    PRIMARY KEY (preference_id, skill_id)
);


-- Preferred academic schools.

CREATE TABLE preferred_partner_faculties (
    preference_id UUID NOT NULL
        REFERENCES student_partner_preferences(preference_id)
        ON DELETE CASCADE,

    faculty_id UUID NOT NULL
        REFERENCES faculties(faculty_id),

    PRIMARY KEY (preference_id, faculty_id)
);


-- Preferred academic departments.

CREATE TABLE preferred_partner_departments (
    preference_id UUID NOT NULL
        REFERENCES student_partner_preferences(preference_id)
        ON DELETE CASCADE,

    department_id UUID NOT NULL
        REFERENCES departments(department_id),

    PRIMARY KEY (preference_id, department_id)
);


-- Preferred academic courses.

CREATE TABLE preferred_partner_courses (
    preference_id UUID NOT NULL
        REFERENCES student_partner_preferences(preference_id)
        ON DELETE CASCADE,

    course_id UUID NOT NULL
        REFERENCES courses(course_id),

    PRIMARY KEY (preference_id, course_id)
);


-- =====================================================
-- 5. PROFILE REVIEW WORKFLOW
-- =====================================================

ALTER TABLE student_profiles

ADD COLUMN profile_review_status VARCHAR(30)
    NOT NULL DEFAULT 'draft',

ADD COLUMN profile_submitted_at TIMESTAMPTZ,

ADD COLUMN profile_reviewed_at TIMESTAMPTZ,

ADD COLUMN profile_reviewed_by UUID
    REFERENCES users(user_id)
    ON DELETE SET NULL,

ADD CONSTRAINT student_profile_review_status_check
CHECK (
    profile_review_status IN (
        'draft',
        'submitted',
        'changes_requested',
        'approved'
    )
);


-- Keep a history of profile reviews.

CREATE TABLE profile_review_history (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id)
        ON DELETE CASCADE,

    reviewed_by UUID
        REFERENCES users(user_id)
        ON DELETE SET NULL,

    review_action VARCHAR(30) NOT NULL,

    review_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT profile_review_action_check
    CHECK (
        review_action IN (
            'submitted',
            'approved',
            'changes_requested',
            'resubmitted'
        )
    )
);


-- =====================================================
-- 6. INDEXES
-- =====================================================

CREATE INDEX idx_student_collaboration_status
ON student_profiles(collaboration_status);

CREATE INDEX idx_student_profile_review_status
ON student_profiles(profile_review_status);

CREATE INDEX idx_student_interests_interest
ON student_interests(interest_id);

CREATE INDEX idx_student_collaboration_types_type
ON student_collaboration_types(collaboration_type_id);

CREATE INDEX idx_profile_review_history_student
ON profile_review_history(student_id);

CREATE INDEX idx_profile_review_history_reviewer
ON profile_review_history(reviewed_by);


-- =====================================================
-- 7. AUTOMATIC UPDATED_AT MANAGEMENT
-- =====================================================

CREATE TRIGGER update_partner_preferences_updated_at
BEFORE UPDATE ON student_partner_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


COMMIT;