-- Prevent duplicate self-reported assessments
-- for the same student and skill.

CREATE UNIQUE INDEX uq_self_reported_assessment_per_skill
ON skill_assessments (student_id, skill_id)
WHERE assessment_method = 'self_reported';