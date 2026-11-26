import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { canViewPublicStudentProfile } from '../utils/publicProfileSerializer.js';

// Send a direct collaboration request.
export const sendStudentCollaborationRequest = async (
    senderId,
    recipientId,
    message
) => {
    if (senderId === recipientId) {
        throw new AppError('You cannot send a request to yourself.', 400);
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Both participants must be active students.
        const participants = await client.query(
            `SELECT
                u.user_id,
                sp.profile_review_status,
                sp.profile_moderation_status,
                COALESCE(us.profile_discoverable, TRUE) AS profile_discoverable
             FROM users u
             JOIN student_profiles sp ON sp.user_id = u.user_id
             LEFT JOIN user_settings us ON us.user_id = u.user_id
             WHERE u.user_id = ANY($1::uuid[])
               AND u.role = 'student'
               AND u.account_status = 'active'
             FOR SHARE OF u, sp`,
            [[senderId, recipientId]]
        );

        if (participants.rows.length !== 2) {
            throw new AppError(
                'The student account could not be found or is inactive.',
                404
            );
        }

        const recipient = participants.rows.find(
            participant => String(participant.user_id) === String(recipientId)
        );
        if (!canViewPublicStudentProfile(
            recipient,
            recipient?.profile_discoverable
        )) {
            throw new AppError(
                'The student account could not be found or is inactive.',
                404
            );
        }

        // Prevent another request if these students have
        // already accepted a collaboration request.
        const existingCollaboration = await client.query(
            `SELECT request_id
             FROM student_collaboration_requests
             WHERE request_status = 'accepted'
               AND (
                    (sender_id = $1 AND recipient_id = $2)
                    OR
                    (sender_id = $2 AND recipient_id = $1)
               )
             LIMIT 1`,
            [senderId, recipientId]
        );

        if (existingCollaboration.rows.length > 0) {
            throw new AppError(
                'You are already connected through an accepted collaboration request.',
                409
            );
        }

        const result = await client.query(
            `INSERT INTO student_collaboration_requests (
                sender_id,
                recipient_id,
                message
             )
             VALUES ($1, $2, $3)
             RETURNING *`,
            [senderId, recipientId, message.trim()]
        );

        await client.query('COMMIT');

        return result.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});

        if (error.code === '23505') {
            throw new AppError(
                'A pending collaboration request already exists between you.',
                409
            );
        }

        throw error;

    } finally {
        client.release();
    }
};


// Get sent or received collaboration requests.
export const getStudentCollaborationRequests = async (
    userId,
    type
) => {
    const column = type === 'sent' ? 'sender_id' : 'recipient_id';
    const otherColumn = type === 'sent' ? 'recipient_id' : 'sender_id';

    const result = await pool.query(
        `SELECT
            cr.request_id,
            cr.message,
            cr.request_status,
            cr.created_at,
            cr.updated_at,

            u.user_id AS student_id,
            u.full_name,

            c.name AS course_name,
            sp.year_of_study

         FROM student_collaboration_requests cr

         JOIN users u
            ON u.user_id = cr.${otherColumn}
           AND u.account_status = 'active'

         LEFT JOIN student_profiles sp
            ON sp.user_id = u.user_id

         LEFT JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id

         LEFT JOIN courses c
            ON c.course_id = rs.course_id

         WHERE cr.${column} = $1

         ORDER BY cr.created_at DESC`,
        [userId]
    );

    return result.rows;
};


// Accept or decline a received request.
export const respondToStudentCollaborationRequest = async (
    requestId,
    recipientId,
    decision
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `SELECT request_id, request_status
             FROM student_collaboration_requests
             WHERE request_id = $1
               AND recipient_id = $2
             FOR UPDATE`,
            [requestId, recipientId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Collaboration request not found.', 404);
        }

        if (result.rows[0].request_status !== 'pending') {
            throw new AppError(
                'This collaboration request has already been handled.',
                409
            );
        }

        const updated = await client.query(
            `UPDATE student_collaboration_requests
             SET request_status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $2
             RETURNING *`,
            [decision, requestId]
        );

        await client.query('COMMIT');

        return updated.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {
        client.release();
    }
};


// Cancel a request sent by the current student.
export const cancelStudentCollaborationRequest = async (
    requestId,
    senderId
) => {
    const result = await pool.query(
        `UPDATE student_collaboration_requests
         SET request_status = 'cancelled',
             updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $1
           AND sender_id = $2
           AND request_status = 'pending'
         RETURNING *`,
        [requestId, senderId]
    );

    if (result.rows.length === 0) {
        throw new AppError(
            'Pending request not found or you are not its sender.',
            404
        );
    }

    return result.rows[0];
};