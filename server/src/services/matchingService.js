import pool from '../config/database.js';

const STUDENT_WEIGHTS = {
    intentions: 20,
    skills: 25,
    interests: 15,
    academics: 10,
    availability: 15,
    preferences: 15
};

const GROUP_WEIGHTS = {
    intentions: 30,
    skills: 45,
    academics: 15,
    commitment: 10
};

const PROFICIENCY_LEVELS = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4
};

const COMMITMENT_LEVELS = {
    flexible: 1,
    moderate: 2,
    high: 3
};


const normalize = (value) =>
    String(value ?? '').trim().toLowerCase();

const intersection = (first = [], second = []) => {
    const secondSet = new Set(second);

    return first.filter((item) => secondSet.has(item));
};

const jaccardScore = (first = [], second = []) => {
    if (!first.length || !second.length) return null;

    const firstSet = new Set(first);
    const secondSet = new Set(second);

    const common = [...firstSet].filter((item) =>
        secondSet.has(item)
    ).length;

    const union = new Set([...first, ...second]).size;

    return union === 0 ? null : (common / union) * 100;
};

const calculateWeightedScore = (factors, weights) => {
    let weightedTotal = 0;
    let availableWeight = 0;

    for (const [factor, score] of Object.entries(factors)) {
        if (score === null || score === undefined) continue;

        const weight = weights[factor];

        weightedTotal += score * weight;
        availableWeight += weight;
    }

    if (availableWeight === 0) return 0;

    return Math.round(weightedTotal / availableWeight);
};

const getStudentData = async (studentId) => {
    const result = await pool.query(
        `SELECT
            u.user_id AS "studentId",
            u.full_name AS "fullName",

            sp.collaboration_status AS "collaborationStatus",
            sp.availability_hours_per_week AS "availabilityHours",
            sp.preferred_meeting_mode AS "meetingMode",
            sp.preferred_meeting_times AS "meetingTimes",
            sp.commitment_level AS "commitmentLevel",
            sp.year_of_study AS "yearOfStudy",

            c.course_id AS "courseId",
            c.name AS "courseName",

            d.department_id AS "departmentId",
            d.name AS "departmentName",

            f.faculty_id AS "facultyId",
            f.name AS "facultyName",

            COALESCE((
    SELECT jsonb_agg(si.intention_id)
    FROM student_intentions si
    WHERE si.student_id = u.user_id
), '[]'::jsonb) AS intentions,

            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ss.skill_id,
                        'name', s.skill_name,
                        'proficiency', ss.proficiency_level
                    )
                )
                FROM student_skills ss
                JOIN skills s ON s.skill_id = ss.skill_id
                WHERE ss.student_id = u.user_id
            ), '[]'::jsonb) AS skills,

            COALESCE((
                SELECT jsonb_agg(si.interest_id)
                FROM student_interests si
                WHERE si.student_id = u.user_id
            ), '[]'::jsonb) AS interests,

            COALESCE((
                SELECT jsonb_build_object(
                    'experienceLevel', spp.preferred_experience_level,
                    'commitmentLevel', spp.preferred_commitment_level,
                    'workingStyle', spp.preferred_working_style,

                    'skills', COALESCE((
                        SELECT jsonb_agg(pps.skill_id)
                        FROM preferred_partner_skills pps
                        WHERE pps.preference_id = spp.preference_id
                    ), '[]'::jsonb),

                    'faculties', COALESCE((
                        SELECT jsonb_agg(ppf.faculty_id)
                        FROM preferred_partner_faculties ppf
                        WHERE ppf.preference_id = spp.preference_id
                    ), '[]'::jsonb),

                    'departments', COALESCE((
                        SELECT jsonb_agg(ppd.department_id)
                        FROM preferred_partner_departments ppd
                        WHERE ppd.preference_id = spp.preference_id
                    ), '[]'::jsonb),

                    'courses', COALESCE((
                        SELECT jsonb_agg(ppc.course_id)
                        FROM preferred_partner_courses ppc
                        WHERE ppc.preference_id = spp.preference_id
                    ), '[]'::jsonb)
                )
                FROM student_partner_preferences spp
                WHERE spp.student_id = u.user_id
            ), '{}'::jsonb) AS preferences

        FROM users u

        JOIN student_profiles sp
            ON sp.user_id = u.user_id

        LEFT JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id

        LEFT JOIN courses c
            ON c.course_id = rs.course_id

        LEFT JOIN departments d
            ON d.department_id = c.department_id

        LEFT JOIN faculties f
            ON f.faculty_id = d.faculty_id

        WHERE u.user_id = $1
          AND u.role = 'student'
          AND u.account_status = 'active'`,
        [studentId]
    );

    return result.rows[0] ?? null;
};
const getStudentCandidates = async (studentId, years = []) => {
    const result = await pool.query(
        `SELECT
            u.user_id AS "studentId",
            u.full_name AS "fullName",

            sp.collaboration_status AS "collaborationStatus",
            sp.availability_hours_per_week AS "availabilityHours",
            sp.preferred_meeting_mode AS "meetingMode",
            sp.preferred_meeting_times AS "meetingTimes",
            sp.commitment_level AS "commitmentLevel",
            sp.year_of_study AS "yearOfStudy",

            c.course_id AS "courseId",
            c.name AS "courseName",

            d.department_id AS "departmentId",
            d.name AS "departmentName",

            f.faculty_id AS "facultyId",
            f.name AS "facultyName",

            COALESCE((
                SELECT jsonb_agg(si.intention_id)
                FROM student_intentions si
                WHERE si.student_id = u.user_id
            ), '[]'::jsonb) AS intentions,

            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ss.skill_id,
                        'name', s.skill_name,
                        'proficiency', ss.proficiency_level
                    )
                )
                FROM student_skills ss
                JOIN skills s ON s.skill_id = ss.skill_id
                WHERE ss.student_id = u.user_id
            ), '[]'::jsonb) AS skills,

            COALESCE((
                SELECT jsonb_agg(si.interest_id)
                FROM student_interests si
                WHERE si.student_id = u.user_id
            ), '[]'::jsonb) AS interests,

            COALESCE((
                SELECT jsonb_build_object(
                    'experienceLevel', spp.preferred_experience_level,
                    'commitmentLevel', spp.preferred_commitment_level,

                    'skills', COALESCE((
                        SELECT jsonb_agg(pps.skill_id)
                        FROM preferred_partner_skills pps
                        WHERE pps.preference_id = spp.preference_id
                    ), '[]'::jsonb),

                    'faculties', COALESCE((
                        SELECT jsonb_agg(ppf.faculty_id)
                        FROM preferred_partner_faculties ppf
                        WHERE ppf.preference_id = spp.preference_id
                    ), '[]'::jsonb),

                    'departments', COALESCE((
                        SELECT jsonb_agg(ppd.department_id)
                        FROM preferred_partner_departments ppd
                        WHERE ppd.preference_id = spp.preference_id
                    ), '[]'::jsonb),

                    'courses', COALESCE((
                        SELECT jsonb_agg(ppc.course_id)
                        FROM preferred_partner_courses ppc
                        WHERE ppc.preference_id = spp.preference_id
                    ), '[]'::jsonb)
                )
                FROM student_partner_preferences spp
                WHERE spp.student_id = u.user_id
            ), '{}'::jsonb) AS preferences

        FROM users u

        JOIN student_profiles sp
            ON sp.user_id = u.user_id

        LEFT JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id

        LEFT JOIN courses c
            ON c.course_id = rs.course_id

        LEFT JOIN departments d
            ON d.department_id = c.department_id

        LEFT JOIN faculties f
            ON f.faculty_id = d.faculty_id

        WHERE u.user_id <> $1
          AND u.role = 'student'
          AND u.account_status = 'active'
          AND sp.collaboration_status IS DISTINCT FROM 'unavailable'

          AND (
              cardinality($2::smallint[]) = 0
              OR sp.year_of_study = ANY($2::smallint[])
          )

          AND NOT EXISTS (
              SELECT 1
              FROM group_members current_member

              JOIN group_members candidate_member
                  ON candidate_member.group_id = current_member.group_id

              WHERE current_member.student_id = $1
                AND candidate_member.student_id = u.user_id
                AND current_member.membership_status = 'active'
                AND candidate_member.membership_status = 'active'
          )`,
        [studentId, years]
    );

    return result.rows;
};

const getIntentionScore = (first, second) => {
    return jaccardScore(first.intentions, second.intentions);
};

const getSkillScore = (first, second) => {
    const firstSkills = first.skills ?? [];
    const secondSkills = second.skills ?? [];

    if (!firstSkills.length || !secondSkills.length) return null;

    const firstIds = firstSkills.map((skill) => skill.id);
    const secondIds = secondSkills.map((skill) => skill.id);

    const sharedScore = jaccardScore(firstIds, secondIds) ?? 0;

    const firstPreferenceSkills =
        first.preferences?.skills ?? [];

    const secondPreferenceSkills =
        second.preferences?.skills ?? [];

    const firstDesired = secondSkills.filter((skill) =>
        firstPreferenceSkills.includes(skill.id)
    ).length;

    const secondDesired = firstSkills.filter((skill) =>
        secondPreferenceSkills.includes(skill.id)
    ).length;

    const preferenceScore =
        ((firstDesired + secondDesired) /
            Math.max(1, firstPreferenceSkills.length +
                secondPreferenceSkills.length)) * 100;

    if (!firstPreferenceSkills.length &&
        !secondPreferenceSkills.length) {
        return sharedScore;
    }

    return Math.round((sharedScore * 0.6) +
        (preferenceScore * 0.4));
};

const getInterestScore = (first, second) => {
    return jaccardScore(first.interests, second.interests);
};

const getAcademicScore = (first, second) => {
    if (first.courseId && first.courseId === second.courseId) {
        return 100;
    }

    if (first.departmentId &&
        first.departmentId === second.departmentId) {
        return 80;
    }

    if (first.facultyId &&
        first.facultyId === second.facultyId) {
        return 60;
    }

    if (first.courseId && second.courseId) {
        return 40;
    }

    return null;
};

const getAvailabilityScore = (first, second) => {
    const scores = [];

    const firstMode = normalize(first.meetingMode);
    const secondMode = normalize(second.meetingMode);

    if (firstMode && secondMode) {
        scores.push(
            firstMode === 'any' ||
            secondMode === 'any' ||
            firstMode === secondMode ? 100 : 0
        );
    }

    const firstHours = Number(first.availabilityHours);
    const secondHours = Number(second.availabilityHours);

    if (first.availabilityHours != null &&
        second.availabilityHours != null) {
        const difference = Math.abs(firstHours - secondHours);

        scores.push(Math.max(0, 100 - difference * 10));
    }

    if (first.commitmentLevel && second.commitmentLevel) {
        const difference = Math.abs(
            (COMMITMENT_LEVELS[first.commitmentLevel] ?? 1) -
            (COMMITMENT_LEVELS[second.commitmentLevel] ?? 1)
        );

        scores.push(100 - (difference * 35));
    }

    if (!scores.length) return null;

    return Math.round(
        scores.reduce((sum, score) => sum + score, 0) /
        scores.length
    );
};

const preferenceDirectionScore = (preferences, candidate) => {
    if (!preferences || !candidate) return null;

    const scores = [];

    const preferredSkills = preferences.skills ?? [];

    if (preferredSkills.length && candidate.skills?.length) {
        const candidateIds = candidate.skills.map(
            (skill) => skill.id
        );

        const matches = intersection(
            preferredSkills,
            candidateIds
        ).length;

        scores.push(
            (matches / preferredSkills.length) * 100
        );
    }

    const preferredCourses = preferences.courses ?? [];
    const preferredDepartments = preferences.departments ?? [];
    const preferredFaculties = preferences.faculties ?? [];

    if (preferredCourses.length && candidate.courseId) {
        scores.push(
            preferredCourses.includes(candidate.courseId) ? 100 : 0
        );
    } else if (preferredDepartments.length &&
        candidate.departmentId) {
        scores.push(
            preferredDepartments.includes(candidate.departmentId)
                ? 100 : 0
        );
    } else if (preferredFaculties.length && candidate.facultyId) {
        scores.push(
            preferredFaculties.includes(candidate.facultyId)
                ? 100 : 0
        );
    }

    if (preferences.commitmentLevel &&
        preferences.commitmentLevel !== 'any' &&
        candidate.commitmentLevel) {
        scores.push(
            preferences.commitmentLevel === candidate.commitmentLevel
                ? 100 : 40
        );
    }

    if (!scores.length) return null;

    return scores.reduce((sum, score) => sum + score, 0) /
        scores.length;
};

const getMutualPreferenceScore = (first, second) => {
    const firstDirection = preferenceDirectionScore(
        first.preferences,
        second
    );

    const secondDirection = preferenceDirectionScore(
        second.preferences,
        first
    );

    if (firstDirection === null && secondDirection === null) {
        return null;
    }

    if (firstDirection === null) return secondDirection;
    if (secondDirection === null) return firstDirection;

    return (firstDirection + secondDirection) / 2;
};

const buildStudentReasons = (first, second, factors) => {
    const reasons = [];

    if (factors.intentions >= 50) {
        reasons.push('You have compatible collaboration intentions.');
    }

    if (factors.skills >= 50) {
        reasons.push('Your skills offer useful overlap and potential collaboration.');
    }

    if (factors.interests >= 50) {
        reasons.push('You share academic or personal interests.');
    }

    if (factors.academics >= 60) {
        reasons.push('You have a related academic background.');
    } else if (factors.academics !== null &&
        factors.academics >= 40) {
        reasons.push('You bring different academic perspectives.');
    }

    if (factors.availability >= 70) {
        reasons.push('Your availability and commitment levels are compatible.');
    }

    if (factors.preferences >= 70) {
        reasons.push('Your teammate preferences align well.');
    }

    return reasons;
};

export const getStudentMatches = async (
    studentId,
    { limit = 20, years = [] } = {}
) => {
    const safeLimit = Math.min(
        Math.max(Number(limit) || 20, 1),
        50
    );

    const uniqueYears = [...new Set(years)];

    if (
        !Array.isArray(uniqueYears) ||
        !uniqueYears.every(
            year => Number.isInteger(year) && year >= 1 && year <= 4
        )
    ) {
        const error = new Error('Invalid academic year filter.');
        error.statusCode = 400;
        throw error;
    }

    const currentStudent = await getStudentData(studentId);

    if (!currentStudent) {
        const error = new Error('Student profile not found.');
        error.statusCode = 404;
        throw error;
    }

    const candidates = await getStudentCandidates(
        studentId,
        uniqueYears
    );

    const matches = candidates.map(candidate => {
        const factors = {
            intentions: getIntentionScore(currentStudent, candidate),
            skills: getSkillScore(currentStudent, candidate),
            interests: getInterestScore(currentStudent, candidate),
            academics: getAcademicScore(currentStudent, candidate),

            availability: getAvailabilityScore(
                currentStudent,
                candidate
            ),

            preferences: getMutualPreferenceScore(
                currentStudent,
                candidate
            )
        };

        const score = calculateWeightedScore(
            factors,
            STUDENT_WEIGHTS
        );

        return {
            studentId: candidate.studentId,
            fullName: candidate.fullName,

            yearOfStudy: candidate.yearOfStudy,

            course: candidate.courseName,
            department: candidate.departmentName,
            faculty: candidate.facultyName,

            score,

            reasons: buildStudentReasons(
                currentStudent,
                candidate,
                factors
            )
        };
    });

    return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit);
};

const getGroupCandidates = async (studentId, studentYear) => {
    const result = await pool.query(
        `SELECT
            sg.group_id AS "groupId",
            sg.group_name AS "groupName",
            sg.description,
            sg.max_members AS "maxMembers",
            sg.intention_id AS "intentionId",
            ci.intention_name AS "intentionName",

            sg.accepts_all_years AS "acceptsAllYears",

            COALESCE((
                SELECT ARRAY_AGG(gay.year_of_study ORDER BY gay.year_of_study)
                FROM group_allowed_years gay
                WHERE gay.group_id = sg.group_id
            ), '{}') AS "allowedYears",

            owner.user_id AS "ownerId",
            owner.full_name AS "ownerName",

            c.course_id AS "courseId",
            c.name AS "courseName",

            d.department_id AS "departmentId",
            d.name AS "departmentName",

            f.faculty_id AS "facultyId",
            f.name AS "facultyName",

            COUNT(DISTINCT gm.membership_id)::int AS "memberCount",

            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', s.skill_id,
                        'name', s.skill_name
                    )
                    ORDER BY s.skill_name
                )
                FROM group_required_skills grs
                JOIN skills s
                    ON s.skill_id = grs.skill_id
                WHERE grs.group_id = sg.group_id
            ), '[]'::jsonb) AS "requiredSkills",

            COALESCE((
                SELECT AVG(
                    CASE sp2.commitment_level
                        WHEN 'flexible' THEN 1
                        WHEN 'moderate' THEN 2
                        WHEN 'high' THEN 3
                    END
                )
                FROM group_members gm2
                JOIN student_profiles sp2
                    ON sp2.user_id = gm2.student_id
                WHERE gm2.group_id = sg.group_id
                  AND gm2.membership_status = 'active'
            ), 1) AS "averageCommitment"

        FROM student_groups sg

        JOIN users owner
            ON owner.user_id = sg.created_by

        LEFT JOIN collaboration_intentions ci
            ON ci.intention_id = sg.intention_id

        LEFT JOIN student_profiles ownerProfile
            ON ownerProfile.user_id = owner.user_id

        LEFT JOIN registry_students rs
            ON rs.registry_student_id =
                ownerProfile.registry_student_id

        LEFT JOIN courses c
            ON c.course_id = rs.course_id

        LEFT JOIN departments d
            ON d.department_id = c.department_id

        LEFT JOIN faculties f
            ON f.faculty_id = d.faculty_id

        LEFT JOIN group_members gm
            ON gm.group_id = sg.group_id
           AND gm.membership_status = 'active'

        WHERE sg.group_status = 'open'
          AND sg.created_by <> $1

          -- Enforce the group's academic year eligibility.
          AND (
              sg.accepts_all_years = TRUE

              OR EXISTS (
                  SELECT 1
                  FROM group_allowed_years gay
                  WHERE gay.group_id = sg.group_id
                    AND gay.year_of_study = $2
              )
          )

          -- Exclude groups the student already belongs to.
          AND NOT EXISTS (
              SELECT 1
              FROM group_members existing
              WHERE existing.group_id = sg.group_id
                AND existing.student_id = $1
                AND existing.membership_status = 'active'
          )

          -- Exclude groups with an existing pending request.
          AND NOT EXISTS (
              SELECT 1
              FROM collaboration_requests cr
              WHERE cr.group_id = sg.group_id
                AND cr.student_id = $1
                AND cr.request_status = 'pending'
          )

        GROUP BY
            sg.group_id,
            sg.group_name,
            sg.description,
            sg.max_members,
            sg.intention_id,
            sg.accepts_all_years,
            ci.intention_name,
            owner.user_id,
            owner.full_name,
            c.course_id,
            c.name,
            d.department_id,
            d.name,
            f.faculty_id,
            f.name

        HAVING COUNT(DISTINCT gm.membership_id) < sg.max_members

        ORDER BY sg.created_at DESC`,
        [studentId, studentYear]
    );

    return result.rows;
};

const getGroupIntentionScore = (student, group) => {
    if (!student.intentions?.length || !group.intentionId) {
        return null;
    }

    return student.intentions.includes(group.intentionId)
        ? 100
        : 25;
};

const getGroupSkillScore = (student, group) => {
    const required = group.requiredSkills ?? [];
    const studentSkills = student.skills ?? [];

    if (!required.length) return null;

    const studentSkillIds = new Set(
        studentSkills.map((skill) => skill.id)
    );

    const covered = required.filter((skill) =>
        studentSkillIds.has(skill.id)
    ).length;

    return (covered / required.length) * 100;
};

const getGroupAcademicScore = (student, group) => {
    if (student.courseId && student.courseId === group.courseId) {
        return 100;
    }

    if (student.departmentId &&
        student.departmentId === group.departmentId) {
        return 80;
    }

    if (student.facultyId &&
        student.facultyId === group.facultyId) {
        return 60;
    }

    if (student.courseId && group.courseId) {
        return 40;
    }

    return null;
};

const getGroupCommitmentScore = (student, group) => {
    if (!student.commitmentLevel) return null;

    const studentLevel =
        COMMITMENT_LEVELS[student.commitmentLevel];

    if (!studentLevel) return null;

    const difference = Math.abs(
        studentLevel - Number(group.averageCommitment)
    );

    return Math.max(0, 100 - (difference * 35));
};

export const getGroupMatches = async (
    studentId,
    { limit = 20 } = {}
) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

    const student = await getStudentData(studentId);

    if (!student) {
        const error = new Error('Student profile not found.');
        error.statusCode = 404;
        throw error;
    }

    const groups = await getGroupCandidates(studentId);

    const matches = groups.map((group) => {
        const factors = {
            intentions: getGroupIntentionScore(student, group),
            skills: getGroupSkillScore(student, group),
            academics: getGroupAcademicScore(student, group),
            commitment: getGroupCommitmentScore(student, group)
        };

        const score = calculateWeightedScore(
            factors,
            GROUP_WEIGHTS
        );

        const reasons = [];

        if (factors.intentions === 100) {
            reasons.push('This group shares one of your collaboration intentions.');
        }

        if (factors.skills >= 50) {
            reasons.push('Your skills cover several of this group’s requirements.');
        }

        if (factors.academics >= 60) {
            reasons.push('The group has a related academic background.');
        }

        if (factors.commitment >= 70) {
            reasons.push('Your commitment level is compatible with the group.');
        }

        return {
            groupId: group.groupId,
            groupName: group.groupName,
            description: group.description,
            intention: group.intentionName,
            ownerName: group.ownerName,
            course: group.courseName,
            department: group.departmentName,
            faculty: group.facultyName,
            memberCount: group.memberCount,
            maxMembers: group.maxMembers,
            availableSlots: group.maxMembers - group.memberCount,
            requiredSkills: group.requiredSkills,
            score,
            reasons
        };
    });

    return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit);
};