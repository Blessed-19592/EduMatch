
import { AppError } from '../utils/AppError.js';
import pool from '../config/database.js';


// Create a new collaboration group.
export const createGroup = async (userId, groupData) => {
    const {
        groupName,
        description,
        maxMembers,
        intentionId,
        collaborationTypeId,
        objectives,
        expectedDeliverables,
        memberResponsibilities,
        memberExpectations,
        requiredSkillIds = []
    } = groupData;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Validate the collaboration intention.
        const intention = await client.query(
            `SELECT intention_id
             FROM collaboration_intentions
             WHERE intention_id = $1`,
            [intentionId]
        );

        if (intention.rows.length === 0) {
            throw new AppError('Invalid collaboration intention.', 400);
        }

        // Validate the collaboration type.
        const type = await client.query(
            `SELECT collaboration_type_id
             FROM collaboration_types
             WHERE collaboration_type_id = $1`,
            [collaborationTypeId]
        );

        if (type.rows.length === 0) {
            throw new AppError('Invalid collaboration type.', 400);
        }

        // Validate all required skills.
        const uniqueSkillIds = [...new Set(requiredSkillIds)];

        if (uniqueSkillIds.length > 0) {
            const skills = await client.query(
                `SELECT skill_id
                 FROM skills
                 WHERE skill_id = ANY($1::uuid[])`,
                [uniqueSkillIds]
            );

            if (skills.rows.length !== uniqueSkillIds.length) {
                throw new AppError('One or more selected skills are invalid.', 400);
            }
        }

        // Create the group.
        const groupResult = await client.query(
            `INSERT INTO student_groups (
                group_name,
                description,
                created_by,
                max_members,
                intention_id,
                collaboration_type_id,
                objectives,
                expected_deliverables,
                member_responsibilities,
                member_expectations
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                groupName.trim(),
                description?.trim() || null,
                userId,
                maxMembers,
                intentionId,
                collaborationTypeId,
                objectives.trim(),
                expectedDeliverables.trim(),
                memberResponsibilities.trim(),
                memberExpectations.trim()
            ]
        );

        const group = groupResult.rows[0];

        // Add required skills.
        if (uniqueSkillIds.length > 0) {
            const values = [];
            const parameters = [];

            uniqueSkillIds.forEach((skillId, index) => {
                const offset = index * 2;

                values.push(`($${offset + 1}, $${offset + 2})`);
                parameters.push(group.group_id, skillId);
            });

            await client.query(
                `INSERT INTO group_required_skills (
                    group_id,
                    skill_id
                 )
                 VALUES ${values.join(', ')}`,
                parameters
            );
        }

        // Migration 010 automatically creates the owner's membership.
        await client.query('COMMIT');

        return group;

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {
        client.release();
    }
};

// Submit a request to join an open group.
export const submitMembershipRequest = async (
    groupId,
    studentId,
    message
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

        if (group.group_status !== 'open') {
            throw new AppError('This group is not accepting requests.', 409);
        }

        if (group.created_by === studentId) {
            throw new AppError('You cannot request to join your own group.', 400);
        }

        const membership = await client.query(
            `SELECT membership_id
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
               AND membership_status = 'active'`,
            [groupId, studentId]
        );

        if (membership.rows.length > 0) {
            throw new AppError('You are already a member of this group.', 409);
        }

        const result = await client.query(
            `INSERT INTO collaboration_requests (
                group_id, student_id, message
             )
             VALUES ($1, $2, $3)
             RETURNING *`,
            [groupId, studentId, message?.trim() || null]
        );

        await client.query('COMMIT');

        return result.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});

        if (error.code === '23505') {
            throw new AppError(
                'You already have a pending request for this group.',
                409
            );
        }

        throw error;

    } finally {
        client.release();
    }
};


// Retrieve pending requests for a group owner.
export const getGroupMembershipRequests = async (
    groupId,
    ownerId
) => {
    const result = await pool.query(
        `SELECT
            cr.request_id,
            cr.group_id,
            cr.student_id,
            cr.message,
            cr.request_status,
            cr.created_at,
            u.full_name,
            c.course_name
         FROM collaboration_requests cr
         JOIN student_groups sg
            ON sg.group_id = cr.group_id
         JOIN group_members gm
            ON gm.group_id = sg.group_id
           AND gm.student_id = $2
           AND gm.membership_role = 'owner'
           AND gm.membership_status = 'active'
         JOIN users u
            ON u.user_id = cr.student_id
         LEFT JOIN student_profiles sp
            ON sp.user_id = cr.student_id
         LEFT JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id
         LEFT JOIN courses c
            ON c.course_id = rs.course_id
         WHERE cr.group_id = $1
           AND cr.request_status = 'pending'
         ORDER BY cr.created_at ASC`,
        [groupId, ownerId]
    );

    return result.rows;
};


// Accept or reject a membership request.
export const respondToMembershipRequest = async (
    requestId,
    ownerId,
    decision
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const requestResult = await client.query(
            `SELECT
                cr.request_id,
                cr.group_id,
                cr.student_id,
                cr.request_status
             FROM collaboration_requests cr
             JOIN group_members gm
                ON gm.group_id = cr.group_id
             WHERE cr.request_id = $1
               AND gm.student_id = $2
               AND gm.membership_role = 'owner'
               AND gm.membership_status = 'active'
             FOR UPDATE OF cr`,
            [requestId, ownerId]
        );

        if (requestResult.rows.length === 0) {
            throw new AppError(
                'Request not found or you are not the group owner.',
                404
            );
        }

        const request = requestResult.rows[0];

        // Lock the group to serialize membership decisions.
        const groupResult = await client.query(
            `SELECT group_id, group_status
             FROM student_groups
             WHERE group_id = $1
             FOR UPDATE`,
            [request.group_id]
        );

        const group = groupResult.rows[0];

        if (request.request_status !== 'pending') {
            throw new AppError('This request has already been handled.', 409);
        }

        if (decision === 'accepted') {
            if (group.group_status !== 'open') {
                throw new AppError(
                    'This group is no longer accepting members.',
                    409
                );
            }

            await client.query(
                `INSERT INTO group_members (
                    group_id, student_id, membership_role, membership_status
                 )
                 VALUES ($1, $2, 'member', 'active')`,
                [request.group_id, request.student_id]
            );
        }

        const updatedRequest = await client.query(
            `UPDATE collaboration_requests
             SET request_status = $1,
                 updated_at = NOW()
             WHERE request_id = $2
             RETURNING *`,
            [decision, requestId]
        );

        await client.query('COMMIT');

        return updatedRequest.rows[0];

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
                'The student is already an active member.',
                409
            );
        }

        throw error;

    } finally {
        client.release();
    }
};