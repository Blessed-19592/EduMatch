import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';


// ======================================
// GET STUDENT PROFILE
// ======================================

export const getStudentProfile = async (userId) => {

    const result = await pool.query(
        `SELECT
            u.user_id,
            u.full_name,
            u.email,
            u.registration_number,

            sp.bio,
            sp.profile_picture_url,

            sp.collaboration_status,
            sp.availability_hours_per_week,
            sp.preferred_meeting_mode,
            sp.preferred_meeting_times,
            sp.commitment_level,

            sp.profile_review_status,
            sp.profile_submitted_at,
            sp.profile_reviewed_at,

            rs.student_status,

            i.institution_id,
            i.name AS institution_name,

            f.faculty_id,
            f.name AS faculty_name,

            d.department_id,
            d.name AS department_name,

            c.course_id,
            c.name AS course_name,

            rs.year_of_study

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

         LEFT JOIN institutions i
            ON i.institution_id = f.institution_id

         WHERE u.user_id = $1
           AND u.role = 'student'`,

        [userId]
    );

    if (result.rows.length === 0) {
        throw new AppError('Student profile not found.', 404);
    }

    return result.rows[0];
};


// ======================================
// UPDATE STUDENT PROFILE
// ======================================

export const updateStudentProfile = async (userId, data) => {

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        // Lock the profile to prevent simultaneous edits
        // from conflicting with profile review operations.

        const profileResult = await client.query(
            `SELECT profile_review_status
             FROM student_profiles
             WHERE user_id = $1
             FOR UPDATE`,
            [userId]
        );

        if (profileResult.rows.length === 0) {
            throw new AppError('Student profile not found.', 404);
        }

        const reviewStatus = profileResult.rows[0].profile_review_status;

        // Do not allow changes while an admin is reviewing
        // the submitted profile.

        if (reviewStatus === 'submitted') {
            throw new AppError(
                'Your profile is awaiting admin review. You cannot edit it right now.',
                409
            );
        }

        // Only these fields can be updated by students.
        // Academic identity and review fields are deliberately excluded.

        const allowedFields = {
            bio: 'bio',
            profilePictureUrl: 'profile_picture_url',
            collaborationStatus: 'collaboration_status',
            availabilityHoursPerWeek: 'availability_hours_per_week',
            preferredMeetingMode: 'preferred_meeting_mode',
            preferredMeetingTimes: 'preferred_meeting_times',
            commitmentLevel: 'commitment_level'
        };

        const updates = [];
        const values = [userId];

        for (const [field, column] of Object.entries(allowedFields)) {

            if (Object.hasOwn(data, field)) {

                values.push(
                    field === 'preferredMeetingTimes'
                        ? JSON.stringify(data[field])
                        : data[field]
                );

                updates.push(
                    `${column} = $${values.length}${field === 'preferredMeetingTimes' ? '::jsonb' : ''}`
                );
            }
        }

        if (updates.length === 0) {
            throw new AppError(
                'No profile changes were provided.',
                400
            );
        }

        updates.push('updated_at = NOW()');

        // Editing an approved profile resets it to draft.
        // A changes-requested profile remains in that state
        // until the student resubmits it.

        if (reviewStatus === 'approved') {

            updates.push("profile_review_status = 'draft'");
            updates.push('profile_submitted_at = NULL');
            updates.push('profile_reviewed_at = NULL');
            updates.push('profile_reviewed_by = NULL');

        }

        await client.query(
            `UPDATE student_profiles
             SET ${updates.join(', ')}
             WHERE user_id = $1`,
            values
        );

        await client.query('COMMIT');

        return await getStudentProfile(userId);

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {

        client.release();

    }
};