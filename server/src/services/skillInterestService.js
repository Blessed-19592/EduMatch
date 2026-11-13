import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';


// ======================================
// PROFILE EDITING SAFEGUARD
// ======================================

const lockStudentProfile = async (client, userId) => {
    const result = await client.query(
        `SELECT profile_review_status
         FROM student_profiles
         WHERE user_id = $1
         FOR UPDATE`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new AppError('Student profile not found.', 404);
    }

    const status = result.rows[0].profile_review_status;

    if (status === 'submitted') {
        throw new AppError(
            'Your profile is awaiting admin review. You cannot edit it right now.',
            409
        );
    }

    // Editing an approved profile requires another review.
    if (status === 'approved') {
        await client.query(
            `UPDATE student_profiles
             SET profile_review_status = 'draft',
                 profile_submitted_at = NULL,
                 profile_reviewed_at = NULL,
                 profile_reviewed_by = NULL,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [userId]
        );
    }
};


// ======================================
// SKILL CATALOG
// ======================================

export const getSkillCatalog = async ({ search, category }) => {
    const result = await pool.query(
        `SELECT
            skill_id,
            skill_name,
            category
         FROM skills
         WHERE
            ($1::text IS NULL OR skill_name ILIKE '%' || $1 || '%')
            AND
            ($2::text IS NULL OR category = $2)
         ORDER BY category, skill_name
         LIMIT 100`,
        [search || null, category || null]
    );

    return result.rows;
};


// ======================================
// INTEREST CATALOG
// ======================================

export const getInterestCatalog = async ({ search, category }) => {
    const result = await pool.query(
        `SELECT
            interest_id,
            interest_name,
            interest_category
         FROM interests
         WHERE
            ($1::text IS NULL OR interest_name ILIKE '%' || $1 || '%')
            AND
            ($2::text IS NULL OR interest_category = $2)
         ORDER BY interest_category, interest_name
         LIMIT 100`,
        [search || null, category || null]
    );

    return result.rows;
};


// ======================================
// GET STUDENT SKILLS
// ======================================

export const getStudentSkills = async (userId) => {
    const result = await pool.query(
        `SELECT
            s.skill_id,
            s.skill_name,
            s.category,
            ss.proficiency_level,
            ss.created_at
         FROM student_skills ss
         JOIN skills s
            ON s.skill_id = ss.skill_id
         WHERE ss.student_id = $1
         ORDER BY s.category, s.skill_name`,
        [userId]
    );

    return result.rows;
};


// ======================================
// REPLACE STUDENT SKILLS
// ======================================

export const replaceStudentSkills = async (userId, skills) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await lockStudentProfile(client, userId);

        // Remove the student's existing selections.
        await client.query(
            `DELETE FROM student_skills
             WHERE student_id = $1`,
            [userId]
        );

        // Insert the new selections only if they exist
        // in the approved skills catalog.
        const result = await client.query(
            `INSERT INTO student_skills (
                student_id,
                skill_id,
                proficiency_level
             )
             SELECT
                $1,
                submitted.skill_id,
                submitted.proficiency_level
             FROM jsonb_to_recordset($2::jsonb)
                AS submitted(
                    skill_id uuid,
                    proficiency_level text
                )
             JOIN skills s
                ON s.skill_id = submitted.skill_id`,
            [
    userId,
    JSON.stringify(
        skills.map(({ skillId, proficiencyLevel }) => ({
            skill_id: skillId,
            proficiency_level: proficiencyLevel
        }))
    )
]
        );

        // Ensure every submitted skill was valid.
        if (result.rowCount !== skills.length) {
            throw new AppError(
                'One or more selected skills do not exist.',
                400
            );
        }

        await client.query('COMMIT');

        return await getStudentSkills(userId);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
};


// ======================================
// GET STUDENT INTERESTS
// ======================================

export const getStudentInterests = async (userId) => {
    const result = await pool.query(
        `SELECT
            i.interest_id,
            i.interest_name,
            i.interest_category,
            si.created_at
         FROM student_interests si
         JOIN interests i
            ON i.interest_id = si.interest_id
         WHERE si.student_id = $1
         ORDER BY i.interest_category, i.interest_name`,
        [userId]
    );

    return result.rows;
};


// ======================================
// REPLACE STUDENT INTERESTS
// ======================================

export const replaceStudentInterests = async (userId, interestIds) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await lockStudentProfile(client, userId);

        await client.query(
            `DELETE FROM student_interests
             WHERE student_id = $1`,
            [userId]
        );

        const result = await client.query(
            `INSERT INTO student_interests (
                student_id,
                interest_id
             )
             SELECT
                $1,
                submitted.interest_id
             FROM unnest($2::uuid[]) AS submitted(interest_id)
             JOIN interests i
                ON i.interest_id = submitted.interest_id`,
            [userId, interestIds]
        );

        if (result.rowCount !== interestIds.length) {
            throw new AppError(
                'One or more selected interests do not exist.',
                400
            );
        }

        await client.query('COMMIT');

        return await getStudentInterests(userId);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
};

// ======================================
// GET COLLABORATION INTENTIONS CATALOG
// ======================================

export const getCollaborationIntentions = async () => {
    const result = await pool.query(
        `SELECT
            intention_id,
            intention_code,
            intention_name,
            description
         FROM collaboration_intentions
         ORDER BY intention_name`
    );

    return result.rows;
};


// ======================================
// GET STUDENT COLLABORATION INTENTIONS
// ======================================

export const getStudentIntentions = async (userId) => {
    const result = await pool.query(
        `SELECT
            ci.intention_id,
            ci.intention_code,
            ci.intention_name,
            ci.description,
            si.created_at
         FROM student_intentions si
         JOIN collaboration_intentions ci
            ON ci.intention_id = si.intention_id
         WHERE si.student_id = $1
         ORDER BY ci.intention_name`,
        [userId]
    );

    return result.rows;
};


// ======================================
// REPLACE STUDENT COLLABORATION INTENTIONS
// ======================================

export const replaceStudentIntentions = async (
    userId,
    intentionIds
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await lockStudentProfile(client, userId);

        await client.query(
            `DELETE FROM student_intentions
             WHERE student_id = $1`,
            [userId]
        );

        const result = await client.query(
            `INSERT INTO student_intentions (
                student_id,
                intention_id
             )
             SELECT
                $1,
                submitted.intention_id
             FROM unnest($2::uuid[]) AS submitted(intention_id)
             JOIN collaboration_intentions ci
                ON ci.intention_id = submitted.intention_id`,
            [userId, intentionIds]
        );

        if (result.rowCount !== intentionIds.length) {
            throw new AppError(
                'One or more selected collaboration intentions do not exist.',
                400
            );
        }

        await client.query('COMMIT');

        return await getStudentIntentions(userId);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
};

// ======================================
// STUDENT PARTNER PREFERENCES
// ======================================

// GET STUDENT PARTNER PREFERENCES

export const getStudentPartnerPreferences = async (userId) => {
    const result = await pool.query(
        `SELECT
            spp.preference_id,
            spp.preferred_experience_level,
            spp.preferred_commitment_level,
            spp.preferred_working_style,
            spp.additional_preferences,

            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'skillId', s.skill_id,
                        'skillName', s.skill_name,
                        'category', s.category
                    )
                    ORDER BY s.skill_name
                )
                FROM preferred_partner_skills pps
                JOIN skills s ON s.skill_id = pps.skill_id
                WHERE pps.preference_id = spp.preference_id
            ), '[]'::jsonb) AS preferred_skills,

            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'facultyId', f.faculty_id,
                        'facultyName', f.faculty_name
                    )
                    ORDER BY f.faculty_name
                )
                FROM preferred_partner_faculties ppf
                JOIN faculties f ON f.faculty_id = ppf.faculty_id
                WHERE ppf.preference_id = spp.preference_id
            ), '[]'::jsonb) AS preferred_faculties,

            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'departmentId', d.department_id,
                        'departmentName', d.department_name
                    )
                    ORDER BY d.department_name
                )
                FROM preferred_partner_departments ppd
                JOIN departments d ON d.department_id = ppd.department_id
                WHERE ppd.preference_id = spp.preference_id
            ), '[]'::jsonb) AS preferred_departments,

            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'courseId', c.course_id,
                        'courseName', c.course_name
                    )
                    ORDER BY c.course_name
                )
                FROM preferred_partner_courses ppc
                JOIN courses c ON c.course_id = ppc.course_id
                WHERE ppc.preference_id = spp.preference_id
            ), '[]'::jsonb) AS preferred_courses

         FROM student_partner_preferences spp
         WHERE spp.student_id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return {
            preferredExperienceLevel: 'any',
            preferredCommitmentLevel: 'any',
            preferredWorkingStyle: 'any',
            additionalPreferences: null,
            preferredSkills: [],
            preferredFaculties: [],
            preferredDepartments: [],
            preferredCourses: []
        };
    }

    return result.rows[0];
};


// REPLACE STUDENT PARTNER PREFERENCES

export const replaceStudentPartnerPreferences = async (
    userId,
    preferences
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await lockStudentProfile(client, userId);

        const preferenceResult = await client.query(
            `INSERT INTO student_partner_preferences (
                student_id,
                preferred_experience_level,
                preferred_commitment_level,
                preferred_working_style,
                additional_preferences
             )
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id)
             DO UPDATE SET
                preferred_experience_level = EXCLUDED.preferred_experience_level,
                preferred_commitment_level = EXCLUDED.preferred_commitment_level,
                preferred_working_style = EXCLUDED.preferred_working_style,
                additional_preferences = EXCLUDED.additional_preferences,
                updated_at = NOW()
             RETURNING preference_id`,
            [
                userId,
                preferences.preferredExperienceLevel,
                preferences.preferredCommitmentLevel,
                preferences.preferredWorkingStyle,
                preferences.additionalPreferences
            ]
        );

        const preferenceId = preferenceResult.rows[0].preference_id;

        // Replace selected preferred skills.
        await client.query(
            `DELETE FROM preferred_partner_skills
             WHERE preference_id = $1`,
            [preferenceId]
        );

        const skillsResult = await client.query(
            `INSERT INTO preferred_partner_skills (
                preference_id,
                skill_id
             )
             SELECT $1, submitted.skill_id
             FROM unnest($2::uuid[]) AS submitted(skill_id)
             JOIN skills s ON s.skill_id = submitted.skill_id`,
            [preferenceId, preferences.preferredSkillIds]
        );

        if (skillsResult.rowCount !== preferences.preferredSkillIds.length) {
            throw new AppError('One or more preferred skills do not exist.', 400);
        }

        // Replace preferred faculties.
        await client.query(
            `DELETE FROM preferred_partner_faculties
             WHERE preference_id = $1`,
            [preferenceId]
        );

        const facultiesResult = await client.query(
            `INSERT INTO preferred_partner_faculties (
                preference_id,
                faculty_id
             )
             SELECT $1, submitted.faculty_id
             FROM unnest($2::uuid[]) AS submitted(faculty_id)
             JOIN faculties f ON f.faculty_id = submitted.faculty_id`,
            [preferenceId, preferences.preferredFacultyIds]
        );

        if (facultiesResult.rowCount !== preferences.preferredFacultyIds.length) {
            throw new AppError('One or more preferred faculties do not exist.', 400);
        }

        // Replace preferred departments.
        await client.query(
            `DELETE FROM preferred_partner_departments
             WHERE preference_id = $1`,
            [preferenceId]
        );

        const departmentsResult = await client.query(
            `INSERT INTO preferred_partner_departments (
                preference_id,
                department_id
             )
             SELECT $1, submitted.department_id
             FROM unnest($2::uuid[]) AS submitted(department_id)
             JOIN departments d ON d.department_id = submitted.department_id`,
            [preferenceId, preferences.preferredDepartmentIds]
        );

        if (departmentsResult.rowCount !== preferences.preferredDepartmentIds.length) {
            throw new AppError('One or more preferred departments do not exist.', 400);
        }

        // Replace preferred courses.
        await client.query(
            `DELETE FROM preferred_partner_courses
             WHERE preference_id = $1`,
            [preferenceId]
        );

        const coursesResult = await client.query(
            `INSERT INTO preferred_partner_courses (
                preference_id,
                course_id
             )
             SELECT $1, submitted.course_id
             FROM unnest($2::uuid[]) AS submitted(course_id)
             JOIN courses c ON c.course_id = submitted.course_id`,
            [preferenceId, preferences.preferredCourseIds]
        );

        if (coursesResult.rowCount !== preferences.preferredCourseIds.length) {
            throw new AppError('One or more preferred courses do not exist.', 400);
        }

        await client.query('COMMIT');

        return await getStudentPartnerPreferences(userId);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
};
