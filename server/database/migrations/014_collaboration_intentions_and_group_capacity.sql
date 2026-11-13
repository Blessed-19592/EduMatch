BEGIN;

-- 1. Rename Learning to Peer Learning Partnership.
-- Preserve its existing UUID and student selections.
UPDATE collaboration_intentions
SET
    intention_code = 'PEER_LEARNING',
    intention_name = 'Peer Learning Partnership'
WHERE intention_code = 'LEARNING';

-- 2. Add the fifth collaboration intention.
INSERT INTO collaboration_intentions (
    intention_code,
    intention_name
)
VALUES (
    'STUDY_GROUP',
    'Study Group'
)
ON CONFLICT (intention_code) DO NOTHING;

-- 3. Remove the obsolete collaboration-type system.
ALTER TABLE student_groups
DROP CONSTRAINT IF EXISTS student_groups_collaboration_type_id_fkey;

DROP INDEX IF EXISTS idx_groups_collaboration_type;

ALTER TABLE student_groups
DROP COLUMN IF EXISTS collaboration_type_id;

DROP TABLE IF EXISTS student_collaboration_types;
DROP TABLE IF EXISTS collaboration_types;

-- 4. Restrict group sizes to 2–15 members.
ALTER TABLE student_groups
DROP CONSTRAINT IF EXISTS student_groups_max_members_check;

ALTER TABLE student_groups
ADD CONSTRAINT student_groups_max_members_check
CHECK (max_members >= 2 AND max_members <= 15);

COMMIT;