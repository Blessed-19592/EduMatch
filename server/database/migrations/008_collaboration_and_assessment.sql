BEGIN;

-- =====================================================
-- 1. COLLABORATION INTENTIONS
-- =====================================================

CREATE TABLE collaboration_intentions (
    intention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intention_code VARCHAR(50) NOT NULL UNIQUE,
    intention_name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO collaboration_intentions
    (intention_code, intention_name, description)
VALUES
(
    'LEARNING',
    'Learning & Skill Development',
    'Collaborating to learn new skills, practise concepts and improve abilities.'
),
(
    'COURSEWORK',
    'Coursework & Academic Assignments',
    'Working together on coursework, assignments and academic activities.'
),
(
    'PERSONAL_PROJECTS',
    'Personal Projects',
    'Building independent projects and turning personal ideas into practical work.'
),
(
    'ADVANCED_PROJECTS',
    'Advanced Projects',
    'Collaborating on complex projects involving advanced knowledge and skills.'
);


-- =====================================================
-- 2. STUDENT COLLABORATION INTERESTS
-- =====================================================

CREATE TABLE student_intentions (
    student_id UUID NOT NULL
        REFERENCES student_profiles(user_id) ON DELETE CASCADE,

    intention_id UUID NOT NULL
        REFERENCES collaboration_intentions(intention_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (student_id, intention_id)
);


-- =====================================================
-- 3. ASSIGN AN INTENTION TO EACH GROUP
-- =====================================================

ALTER TABLE student_groups
ADD COLUMN intention_id UUID
REFERENCES collaboration_intentions(intention_id);

CREATE INDEX idx_student_groups_intention
ON student_groups(intention_id);


-- =====================================================
-- 4. EXTEND EXISTING PORTFOLIOS
-- =====================================================

-- Existing repository URLs will be retained.
-- New portfolios can use other evidence types.

ALTER TABLE portfolios
ADD COLUMN evidence_type VARCHAR(40)
    NOT NULL DEFAULT 'github_repository',

ADD COLUMN evidence_url TEXT;

-- Preserve existing repository URLs as evidence URLs.
UPDATE portfolios
SET evidence_url = repository_url
WHERE evidence_url IS NULL;

-- A repository URL is no longer compulsory.
ALTER TABLE portfolios
ALTER COLUMN repository_url DROP NOT NULL;

-- Every portfolio item must have a usable evidence URL.
ALTER TABLE portfolios
ADD CONSTRAINT portfolios_evidence_url_required
CHECK (
    evidence_url IS NOT NULL
    AND LENGTH(TRIM(evidence_url)) > 0
);

ALTER TABLE portfolios
ADD CONSTRAINT portfolios_evidence_type_check
CHECK (
    evidence_type IN (
        'github_repository',
        'documentation',
        'live_demo',
        'design_portfolio',
        'research',
        'video_presentation',
        'other'
    )
);


-- =====================================================
-- 5. STUDENT SKILL PROFICIENCY
-- =====================================================

ALTER TABLE student_skills
ADD COLUMN proficiency_level VARCHAR(20)
    NOT NULL DEFAULT 'beginner';

ALTER TABLE student_skills
ADD CONSTRAINT student_skills_proficiency_check
CHECK (
    proficiency_level IN (
        'beginner',
        'intermediate',
        'advanced',
        'expert'
    )
);


-- =====================================================
-- 6. SKILL ASSESSMENTS
-- =====================================================

CREATE TABLE skill_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    student_id UUID NOT NULL,
    skill_id UUID NOT NULL,

    assessment_method VARCHAR(30) NOT NULL,

    assessment_status VARCHAR(30)
        NOT NULL DEFAULT 'pending',

    assessment_summary TEXT,

    demonstrated_capabilities JSONB
        NOT NULL DEFAULT '[]'::jsonb,

    strengths JSONB
        NOT NULL DEFAULT '[]'::jsonb,

    improvement_areas JSONB
        NOT NULL DEFAULT '[]'::jsonb,

    rubric JSONB NOT NULL DEFAULT '{}'::jsonb,

    assessed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (student_id, skill_id)
        REFERENCES student_skills(student_id, skill_id)
        ON DELETE CASCADE,

    CONSTRAINT skill_assessments_method_check
    CHECK (
        assessment_method IN (
            'self_reported',
            'ai_assessed',
            'human_assessed'
        )
    ),

    CONSTRAINT skill_assessments_status_check
    CHECK (
        assessment_status IN (
            'pending',
            'in_progress',
            'completed',
            'needs_review'
        )
    )
);

CREATE INDEX idx_skill_assessments_student
ON skill_assessments(student_id);

CREATE INDEX idx_skill_assessments_skill
ON skill_assessments(skill_id);


-- =====================================================
-- 7. ASSESSMENT EVIDENCE
-- =====================================================

CREATE TABLE assessment_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    assessment_id UUID NOT NULL
        REFERENCES skill_assessments(assessment_id)
        ON DELETE CASCADE,

    portfolio_id UUID
        REFERENCES portfolios(portfolio_id)
        ON DELETE SET NULL,

    evidence_type VARCHAR(40) NOT NULL,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    evidence_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT assessment_evidence_type_check
    CHECK (
        evidence_type IN (
            'github_repository',
            'documentation',
            'live_demo',
            'design_portfolio',
            'research',
            'video_presentation',
            'other'
        )
    ),

    CONSTRAINT assessment_evidence_source_check
    CHECK (
        portfolio_id IS NOT NULL
        OR (
            evidence_url IS NOT NULL
            AND LENGTH(TRIM(evidence_url)) > 0
        )
    )
);

CREATE INDEX idx_assessment_evidence_assessment
ON assessment_evidence(assessment_id);


COMMIT;