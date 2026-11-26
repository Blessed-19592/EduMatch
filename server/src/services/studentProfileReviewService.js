import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export const submitStudentProfileForReview = async (studentId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const profileResult = await client.query(
            `SELECT profile_review_status
             FROM student_profiles
             WHERE user_id = $1
             FOR UPDATE`,
            [studentId]
        );

        if (profileResult.rows.length === 0) {
            throw new AppError('Student profile not found.', 404);
        }

        const currentStatus = profileResult.rows[0].profile_review_status;

        if (currentStatus === 'submitted') {
            throw new AppError(
                'Your profile is already awaiting review.',
                409
            );
        }

        if (currentStatus === 'approved') {
            throw new AppError(
                'Your profile is already approved.',
                409
            );
        }

        const completionResult = await client.query(
            `SELECT
                (SELECT COUNT(*)
                 FROM student_skills
                 WHERE student_id = $1)::int AS skill_count,
                (SELECT COUNT(*)
                 FROM student_intentions
                 WHERE student_id = $1)::int AS intention_count`,
            [studentId]
        );

        const { skill_count: skillCount, intention_count: intentionCount } =
            completionResult.rows[0];

        if (skillCount < 1 || intentionCount < 1) {
            throw new AppError(
                'Add at least one skill and one collaboration intention before submitting your profile.',
                400
            );
        }

        const action =
            currentStatus === 'changes_requested' ? 'resubmitted' : 'submitted';

        const result = await client.query(
            `UPDATE student_profiles
             SET profile_review_status = 'submitted',
                 profile_submitted_at = NOW(),
                 profile_reviewed_at = NULL,
                 profile_reviewed_by = NULL,
                 updated_at = NOW()
             WHERE user_id = $1
             RETURNING profile_review_status, profile_submitted_at`,
            [studentId]
        );

        await client.query(
            `INSERT INTO profile_review_history (
                student_id,
                review_action
             )
             VALUES ($1, $2)`,
            [studentId, action]
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};
