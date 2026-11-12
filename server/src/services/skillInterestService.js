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