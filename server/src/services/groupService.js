
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