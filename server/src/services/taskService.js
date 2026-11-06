
import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';

// Create a task. Only an active group owner can create tasks.
export const createGroupTask = async (groupId, ownerId, taskData) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the group while validating ownership and creating the task.
        const groupResult = await client.query(
            `SELECT sg.group_id
             FROM student_groups sg
             JOIN group_members gm
                ON gm.group_id = sg.group_id
             WHERE sg.group_id = $1
               AND gm.student_id = $2
               AND gm.membership_role = 'owner'
               AND gm.membership_status = 'active'
             FOR UPDATE OF sg`,
            [groupId, ownerId]
        );

        if (groupResult.rows.length === 0) {
            throw new AppError(
                'Only the active group owner can create tasks.',
                403
            );
        }

        // Validate the assigned student, if one was provided.
        if (taskData.assignedTo) {
            const memberResult = await client.query(
                `SELECT membership_id
                 FROM group_members
                 WHERE group_id = $1
                   AND student_id = $2
                   AND membership_status = 'active'`,
                [groupId, taskData.assignedTo]
            );

            if (memberResult.rows.length === 0) {
                throw new AppError(
                    'Tasks can only be assigned to active group members.',
                    400
                );
            }
        }

        const result = await client.query(
            `INSERT INTO group_tasks (
                group_id,
                task_title,
                description,
                assigned_to,
                priority,
                task_status,
                due_date
             )
             VALUES ($1, $2, $3, $4, $5, 'pending', $6)
             RETURNING *`,
            [
                groupId,
                taskData.taskTitle,
                taskData.description || null,
                taskData.assignedTo || null,
                taskData.priority,
                taskData.dueDate || null
            ]
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


// Retrieve tasks and their progress history.
// Only active group members can access them.
export const getGroupTasks = async (groupId, studentId) => {
    const membership = await pool.query(
        `SELECT membership_id
         FROM group_members
         WHERE group_id = $1
           AND student_id = $2
           AND membership_status = 'active'`,
        [groupId, studentId]
    );

    if (membership.rows.length === 0) {
        throw new AppError(
            'You must be an active group member to view these tasks.',
            403
        );
    }

    const tasks = await pool.query(
        `SELECT
            gt.*,
            assignee.full_name AS assigned_to_name,
            creator.full_name AS created_by_name
         FROM group_tasks gt
         LEFT JOIN users assignee
            ON assignee.user_id = gt.assigned_to
         JOIN student_groups sg
            ON sg.group_id = gt.group_id
         JOIN users creator
            ON creator.user_id = sg.created_by
         WHERE gt.group_id = $1
         ORDER BY
            CASE gt.task_status
                WHEN 'pending' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'completed' THEN 3
            END,
            gt.due_date ASC NULLS LAST,
            gt.created_at DESC`,
        [groupId]
    );

    return tasks.rows;
};


// Retrieve progress history for a task.
export const getTaskProgressHistory = async (
    taskId,
    studentId
) => {
    const taskResult = await pool.query(
        `SELECT gt.group_id
         FROM group_tasks gt
         JOIN group_members gm
            ON gm.group_id = gt.group_id
         WHERE gt.task_id = $1
           AND gm.student_id = $2
           AND gm.membership_status = 'active'`,
        [taskId, studentId]
    );

    if (taskResult.rows.length === 0) {
        throw new AppError(
            'Task not found or you do not have access to it.',
            404
        );
    }

    const result = await pool.query(
        `SELECT
            tp.progress_id,
            tp.task_id,
            tp.previous_status,
            tp.new_status,
            tp.progress_note,
            tp.created_at,
            u.full_name AS changed_by_name
         FROM task_progress tp
         JOIN users u
            ON u.user_id = tp.changed_by
         WHERE tp.task_id = $1
         ORDER BY tp.created_at DESC`,
        [taskId]
    );

    return result.rows;
};


// Update task progress transactionally.
// An assigned task can be updated by its assignee or the group owner.
// Unassigned tasks can be updated by any active group member.
export const updateTaskProgress = async (
    taskId,
    studentId,
    newStatus,
    progressNote
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const taskResult = await client.query(
            `SELECT
                gt.task_id,
                gt.group_id,
                gt.task_status,
                gt.assigned_to
             FROM group_tasks gt
             JOIN group_members gm
                ON gm.group_id = gt.group_id
             WHERE gt.task_id = $1
               AND gm.student_id = $2
               AND gm.membership_status = 'active'
             FOR UPDATE OF gt`,
            [taskId, studentId]
        );

        if (taskResult.rows.length === 0) {
            throw new AppError(
                'Task not found or you are not an active group member.',
                404
            );
        }

        const task = taskResult.rows[0];

        if (task.assigned_to && task.assigned_to !== studentId) {
            const ownerResult = await client.query(
                `SELECT membership_id
                 FROM group_members
                 WHERE group_id = $1
                   AND student_id = $2
                   AND membership_role = 'owner'
                   AND membership_status = 'active'`,
                [task.group_id, studentId]
            );

            if (ownerResult.rows.length === 0) {
                throw new AppError(
                    'Only the assignee or group owner can update this task.',
                    403
                );
            }
        }

        const previousStatus = task.task_status;

        await client.query(
            `UPDATE group_tasks
             SET task_status = $1
             WHERE task_id = $2`,
            [newStatus, taskId]
        );

        const progressResult = await client.query(
            `INSERT INTO task_progress (
                task_id,
                changed_by,
                previous_status,
                new_status,
                progress_note
             )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                taskId,
                studentId,
                previousStatus,
                newStatus,
                progressNote || null
            ]
        );

        await client.query('COMMIT');

        return progressResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {
        client.release();
    }
};
