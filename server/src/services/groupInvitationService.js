import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';


// =====================================================
// GET STUDENTS ELIGIBLE FOR INVITATION
// =====================================================

export const getEligibleCollaborators = async (groupId, ownerId) => {
    const groupResult = await pool.query(
        `SELECT group_id
         FROM student_groups
         WHERE group_id = $1
           AND created_by = $2
           AND group_status = 'open'
           AND EXISTS (
               SELECT 1
               FROM group_members
               WHERE group_id = $1
                 AND student_id = $2
                 AND membership_role = 'owner'
                 AND membership_status = 'active'
           )`,
        [groupId, ownerId]
    );

    if (groupResult.rows.length === 0) {
        throw new AppError(
            'Group not found, unavailable, or you are not its owner.',
            404
        );
    }

    const result = await pool.query(
        `SELECT DISTINCT
            u.user_id AS student_id,
            u.full_name,
            c.name AS course_name,
            sp.year_of_study

         FROM student_collaboration_requests scr

         JOIN users u
            ON u.user_id = CASE
                WHEN scr.sender_id = $2 THEN scr.recipient_id
                ELSE scr.sender_id
            END

         JOIN student_profiles sp
            ON sp.user_id = u.user_id

         LEFT JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id

         LEFT JOIN courses c
            ON c.course_id = rs.course_id

         WHERE scr.request_status = 'accepted'
           AND (
               (scr.sender_id = $2 AND scr.recipient_id = u.user_id)
               OR
               (scr.recipient_id = $2 AND scr.sender_id = u.user_id)
           )
           AND u.account_status = 'active'
           AND NOT EXISTS (
               SELECT 1
               FROM group_members gm
               WHERE gm.group_id = $1
                 AND gm.student_id = u.user_id
                 AND gm.membership_status = 'active'
           )
           AND NOT EXISTS (
               SELECT 1
               FROM group_invitations gi
               WHERE gi.group_id = $1
                 AND gi.invitee_id = u.user_id
                 AND gi.invitation_status = 'pending'
           )

         ORDER BY u.full_name ASC`,
        [groupId, ownerId]
    );

    return result.rows;
};


// =====================================================
// SEND A GROUP INVITATION
// =====================================================

export const sendGroupInvitation = async (
    groupId,
    ownerId,
    inviteeId,
    message = null
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const groupResult = await client.query(
            `SELECT group_id, group_status, created_by
             FROM student_groups
             WHERE group_id = $1
             FOR UPDATE`,
            [groupId]
        );

        if (groupResult.rows.length === 0) {
            throw new AppError('Group not found.', 404);
        }

        const group = groupResult.rows[0];

        if (
            String(group.created_by) !== String(ownerId) ||
            group.group_status !== 'open'
        ) {
            throw new AppError(
                'Only the owner of an open group can send invitations.',
                403
            );
        }

        const ownerResult = await client.query(
            `SELECT 1
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
               AND membership_role = 'owner'
               AND membership_status = 'active'`,
            [groupId, ownerId]
        );

        if (ownerResult.rows.length === 0) {
            throw new AppError(
                'You are not the active owner of this group.',
                403
            );
        }

        if (String(ownerId) === String(inviteeId)) {
            throw new AppError('You cannot invite yourself.', 400);
        }

        const inviteeResult = await client.query(
            `SELECT u.user_id
             FROM users u
             JOIN student_profiles sp
                ON sp.user_id = u.user_id
             WHERE u.user_id = $1
               AND u.role = 'student'
               AND u.account_status = 'active'`,
            [inviteeId]
        );

        if (inviteeResult.rows.length === 0) {
            throw new AppError('Student not found or inactive.', 404);
        }

        const collaborationResult = await client.query(
            `SELECT request_id
             FROM student_collaboration_requests
             WHERE request_status = 'accepted'
               AND (
                   (sender_id = $1 AND recipient_id = $2)
                   OR
                   (sender_id = $2 AND recipient_id = $1)
               )
             LIMIT 1`,
            [ownerId, inviteeId]
        );

        if (collaborationResult.rows.length === 0) {
            throw new AppError(
                'You can only invite students with whom you have an accepted collaboration request.',
                403
            );
        }

        const membershipResult = await client.query(
            `SELECT membership_id
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
               AND membership_status = 'active'`,
            [groupId, inviteeId]
        );

        if (membershipResult.rows.length > 0) {
            throw new AppError(
                'This student is already a member of the group.',
                409
            );
        }

        const invitationResult = await client.query(
            `INSERT INTO group_invitations (
                group_id,
                inviter_id,
                invitee_id,
                message
             )
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                groupId,
                ownerId,
                inviteeId,
                message?.trim() || null
            ]
        );

        await client.query('COMMIT');

        return invitationResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});

        if (error.code === '23505') {
            throw new AppError(
                'This student already has a pending invitation to this group.',
                409
            );
        }

        throw error;

    } finally {
        client.release();
    }
};


// =====================================================
// GET RECEIVED OR SENT INVITATIONS
// =====================================================

export const getGroupInvitations = async (userId, type = 'received') => {
    if (!['received', 'sent'].includes(type)) {
        throw new AppError('Invalid invitation type.', 400);
    }

    const userColumn = type === 'sent' ? 'inviter_id' : 'invitee_id';
    const otherColumn = type === 'sent' ? 'invitee_id' : 'inviter_id';

    const result = await pool.query(
        `SELECT
            gi.invitation_id,
            gi.group_id,
            gi.inviter_id,
            gi.invitee_id,
            gi.message,
            gi.invitation_status,
            gi.created_at,
            gi.updated_at,

            sg.group_name,
            sg.group_status,
            sg.max_members,

            other_user.full_name AS other_student_name,
            other_user.user_id AS other_student_id

         FROM group_invitations gi

         JOIN student_groups sg
            ON sg.group_id = gi.group_id

         JOIN users other_user
            ON other_user.user_id = gi.${otherColumn}

         WHERE gi.${userColumn} = $1

         ORDER BY gi.created_at DESC`,
        [userId]
    );

    return result.rows;
};


// =====================================================
// ACCEPT OR DECLINE A GROUP INVITATION
// =====================================================

export const respondToGroupInvitation = async (
    invitationId,
    inviteeId,
    decision
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const invitationResult = await client.query(
            `SELECT
                invitation_id,
                group_id,
                inviter_id,
                invitee_id,
                invitation_status
             FROM group_invitations
             WHERE invitation_id = $1
               AND invitee_id = $2
             FOR UPDATE`,
            [invitationId, inviteeId]
        );

        if (invitationResult.rows.length === 0) {
            throw new AppError('Invitation not found.', 404);
        }

        const invitation = invitationResult.rows[0];

        if (invitation.invitation_status !== 'pending') {
            throw new AppError(
                'This invitation has already been handled.',
                409
            );
        }

        if (decision === 'accepted') {
            // Lock the group before changing membership.
            const groupResult = await client.query(
                `SELECT group_id, group_status, created_by
                 FROM student_groups
                 WHERE group_id = $1
                 FOR UPDATE`,
                [invitation.group_id]
            );

            if (groupResult.rows.length === 0) {
                throw new AppError('Group no longer exists.', 404);
            }

            const group = groupResult.rows[0];

            if (group.group_status !== 'open') {
                throw new AppError(
                    'This group is no longer accepting members.',
                    409
                );
            }

            // Confirm the invitation still comes from the group owner.
            const ownerResult = await client.query(
                `SELECT 1
                 FROM group_members
                 WHERE group_id = $1
                   AND student_id = $2
                   AND membership_role = 'owner'
                   AND membership_status = 'active'`,
                [invitation.group_id, invitation.inviter_id]
            );

            if (
                String(group.created_by) !== String(invitation.inviter_id) ||
                ownerResult.rows.length === 0
            ) {
                throw new AppError(
                    'The invitation is no longer valid.',
                    409
                );
            }

            // Confirm the accepted collaboration still exists.
            const collaborationResult = await client.query(
                `SELECT 1
                 FROM student_collaboration_requests
                 WHERE request_status = 'accepted'
                   AND (
                       (sender_id = $1 AND recipient_id = $2)
                       OR
                       (sender_id = $2 AND recipient_id = $1)
                   )
                 LIMIT 1`,
                [invitation.inviter_id, inviteeId]
            );

            if (collaborationResult.rows.length === 0) {
                throw new AppError(
                    'The accepted collaboration connection no longer exists.',
                    409
                );
            }

            await client.query(
                `INSERT INTO group_members (
                    group_id,
                    student_id,
                    membership_role,
                    membership_status
                 )
                 VALUES ($1, $2, 'member', 'active')`,
                [invitation.group_id, inviteeId]
            );
        }

        const updatedResult = await client.query(
            `UPDATE group_invitations
             SET invitation_status = $1,
                 updated_at = NOW()
             WHERE invitation_id = $2
             RETURNING *`,
            [decision, invitationId]
        );

        await client.query('COMMIT');

        return updatedResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});

        if (error.code === 'P0001') {
            throw new AppError(
                'The group has reached its membership limit.',
                409
            );
        }

        if (error.code === '23505') {
            throw new AppError(
                'You are already an active member of this group.',
                409
            );
        }

        throw error;

    } finally {
        client.release();
    }
};


// =====================================================
// CANCEL A PENDING INVITATION
// =====================================================

export const cancelGroupInvitation = async (
    invitationId,
    ownerId
) => {
    const result = await pool.query(
        `UPDATE group_invitations
         SET invitation_status = 'cancelled',
             updated_at = NOW()
         WHERE invitation_id = $1
           AND inviter_id = $2
           AND invitation_status = 'pending'
         RETURNING *`,
        [invitationId, ownerId]
    );

    if (result.rows.length === 0) {
        throw new AppError(
            'Pending invitation not found or you are not its sender.',
            404
        );
    }

    return result.rows[0];
};