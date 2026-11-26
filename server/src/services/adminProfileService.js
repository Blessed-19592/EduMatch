import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const PROFILE_FILTERS = new Set(['submitted', 'approved', 'hidden']);

export const getAdminProfiles = async ({
    status = 'submitted',
    limit = 50,
    offset = 0
} = {}) => {
    if (!PROFILE_FILTERS.has(status)) {
        throw new AppError('Invalid profile review filter.', 400);
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const result = await pool.query(
        `SELECT
            u.user_id AS "studentId",
            u.full_name AS "fullName",
            sp.bio,
            sp.profile_review_status AS "reviewStatus",
            sp.profile_moderation_status AS "moderationStatus",
            sp.profile_submitted_at AS "submittedAt",
            rs.year_of_study AS "yearOfStudy",
            c.name AS course,
            d.name AS department,
            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'name', s.skill_name,
                        'proficiency', ss.proficiency_level
                    )
                    ORDER BY s.skill_name
                )
                FROM student_skills ss
                JOIN skills s ON s.skill_id = ss.skill_id
                WHERE ss.student_id = u.user_id
            ), '[]'::jsonb) AS skills,
            COALESCE((
                SELECT jsonb_agg(i.interest_name ORDER BY i.interest_name)
                FROM student_interests si
                JOIN interests i ON i.interest_id = si.interest_id
                WHERE si.student_id = u.user_id
            ), '[]'::jsonb) AS interests,
            COALESCE((
                SELECT jsonb_agg(
                    ci.intention_name ORDER BY ci.intention_name
                )
                FROM student_intentions si
                JOIN collaboration_intentions ci
                    ON ci.intention_id = si.intention_id
                WHERE si.student_id = u.user_id
            ), '[]'::jsonb) AS intentions,
            latest.review_action AS "latestReviewAction",
            latest.review_notes AS "latestReviewNotes",
            COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'action', review_entry.review_action,
                        'notes', review_entry.review_notes,
                        'reviewedBy', reviewer.full_name,
                        'createdAt', review_entry.created_at
                    )
                    ORDER BY review_entry.created_at DESC, review_entry.review_id DESC
                )
                FROM (
                    SELECT review_id, review_action, review_notes, reviewed_by, created_at
                    FROM profile_review_history
                    WHERE student_id = sp.user_id
                    ORDER BY created_at DESC, review_id DESC
                    LIMIT 10
                ) review_entry
                LEFT JOIN users reviewer
                    ON reviewer.user_id = review_entry.reviewed_by
            ), '[]'::jsonb) AS "reviewHistory",
            COUNT(*) OVER()::int AS "totalCount"
         FROM student_profiles sp
         JOIN users u
            ON u.user_id = sp.user_id
           AND u.role = 'student'
           AND u.account_status = 'active'
         LEFT JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id
         LEFT JOIN courses c
            ON c.course_id = rs.course_id
         LEFT JOIN departments d
            ON d.department_id = c.department_id
         LEFT JOIN LATERAL (
            SELECT review_action, review_notes
            FROM profile_review_history
            WHERE student_id = sp.user_id
            ORDER BY created_at DESC, review_id DESC
            LIMIT 1
         ) latest ON TRUE
         WHERE (
            ($1 = 'submitted' AND sp.profile_review_status = 'submitted')
            OR (
                $1 = 'approved'
                AND sp.profile_review_status = 'approved'
                AND sp.profile_moderation_status = 'visible'
            )
            OR ($1 = 'hidden' AND sp.profile_moderation_status = 'hidden')
         )
         ORDER BY
            CASE WHEN $1 = 'submitted'
                THEN sp.profile_submitted_at END ASC NULLS LAST,
            sp.updated_at DESC,
            u.user_id
         LIMIT $2 OFFSET $3`,
        [status, safeLimit, safeOffset]
    );

    return {
        profiles: result.rows.map(({ totalCount, ...profile }) => profile),
        totalCount: result.rows[0]?.totalCount ?? 0
    };
};

export const approveAllSubmittedStudentProfiles = async (adminId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `WITH approved_profiles AS (
                UPDATE student_profiles sp
                SET profile_review_status = 'approved',
                    profile_reviewed_at = NOW(),
                    profile_reviewed_by = $1,
                    updated_at = NOW()
                FROM users u
                WHERE u.user_id = sp.user_id
                  AND u.role = 'student'
                  AND u.account_status = 'active'
                  AND sp.profile_review_status = 'submitted'
                RETURNING sp.user_id
            ),
            logged_approvals AS (
                INSERT INTO profile_review_history (
                    student_id,
                    reviewed_by,
                    review_action,
                    review_notes
                )
                SELECT user_id, $1, 'approved', 'Approved in bulk by administrator.'
                FROM approved_profiles
                RETURNING student_id
            )
            SELECT COUNT(*)::int AS "approvedCount"
            FROM logged_approvals`,
            [adminId]
        );

        await client.query('COMMIT');
        return { approvedCount: result.rows[0].approvedCount };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

export const reviewStudentProfile = async (
    adminId,
    studentId,
    { action, notes = null }
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const profileResult = await client.query(
            `SELECT sp.profile_review_status
             FROM student_profiles sp
             JOIN users u ON u.user_id = sp.user_id
             WHERE sp.user_id = $1
               AND u.role = 'student'
               AND u.account_status = 'active'
             FOR UPDATE OF sp`,
            [studentId]
        );

        if (profileResult.rows.length === 0) {
            throw new AppError('Student profile not found.', 404);
        }

        if (profileResult.rows[0].profile_review_status !== 'submitted') {
            throw new AppError(
                'Only submitted profiles can receive a review decision.',
                409
            );
        }

        const reviewStatus =
            action === 'approve' ? 'approved' : 'changes_requested';
        const reviewAction =
            action === 'approve' ? 'approved' : 'changes_requested';

        await client.query(
            `UPDATE student_profiles
             SET profile_review_status = $2,
                 profile_reviewed_at = NOW(),
                 profile_reviewed_by = $3,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [studentId, reviewStatus, adminId]
        );

        await client.query(
            `INSERT INTO profile_review_history (
                student_id,
                reviewed_by,
                review_action,
                review_notes
             )
             VALUES ($1, $2, $3, $4)`,
            [studentId, adminId, reviewAction, notes]
        );

        await client.query('COMMIT');
        return { studentId, reviewStatus };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};

export const moderateStudentProfile = async (
    adminId,
    studentId,
    { action, notes }
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const profileResult = await client.query(
            `SELECT sp.profile_moderation_status
             FROM student_profiles sp
             JOIN users u ON u.user_id = sp.user_id
             WHERE sp.user_id = $1
               AND u.role = 'student'
               AND u.account_status = 'active'
             FOR UPDATE OF sp`,
            [studentId]
        );

        if (profileResult.rows.length === 0) {
            throw new AppError('Student profile not found.', 404);
        }

        const currentStatus =
            profileResult.rows[0].profile_moderation_status;
        const moderationStatus = action === 'hide' ? 'hidden' : 'visible';

        if (currentStatus === moderationStatus) {
            throw new AppError(
                action === 'hide'
                    ? 'This profile is already hidden.'
                    : 'This profile is already visible.',
                409
            );
        }

        await client.query(
            `UPDATE student_profiles
             SET profile_moderation_status = $2,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [studentId, moderationStatus]
        );

        await client.query(
            `INSERT INTO profile_review_history (
                student_id,
                reviewed_by,
                review_action,
                review_notes
             )
             VALUES ($1, $2, $3, $4)`,
            [
                studentId,
                adminId,
                action === 'hide' ? 'profile_hidden' : 'profile_restored',
                notes
            ]
        );

        await client.query('COMMIT');
        return { studentId, moderationStatus };
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};
