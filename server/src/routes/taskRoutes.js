import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth.js';
import { requireStudent } from '../middleware/requireRole.js';
import { AppError } from '../utils/AppError.js';

import {
    createGroupTask,
    getGroupTasks,
    getTaskProgressHistory,
    updateTaskProgress
} from '../services/taskService.js';

const router = express.Router();

const uuidSchema = z.string().uuid();

const createTaskSchema = z.object({
    taskTitle: z.string().trim().min(3).max(150),
    description: z.string().trim().max(3000).optional(),
    assignedTo: uuidSchema.nullable().optional(),
    priority: z.enum(['low', 'medium', 'high']),
    dueDate: z.string().datetime().nullable().optional()
}).strict();

const updateProgressSchema = z.object({
    newStatus: z.enum(['pending', 'in_progress', 'completed']),
    progressNote: z.string().trim().max(2000).optional()
}).strict();


// Create a group task.
router.post(
    '/:groupId/tasks',
    requireAuth,
    requireStudent,
    async (req, res, next) => {
        try {
            const groupId = uuidSchema.parse(req.params.groupId);

            const validation = createTaskSchema.safeParse(req.body);

            if (!validation.success) {
                throw new AppError(
                    'Invalid task information.',
                    400
                );
            }

            const task = await createGroupTask(
                groupId,
                req.currentUser.userId,
                validation.data
            );

            res.status(201).json({
                status: 'success',
                message: 'Task created successfully.',
                task
            });

        } catch (error) {
            next(error);
        }
    }
);


// Retrieve all tasks belonging to a group.
router.get(
    '/:groupId/tasks',
    requireAuth,
    requireStudent,
    async (req, res, next) => {
        try {
            const groupId = uuidSchema.parse(req.params.groupId);

            const tasks = await getGroupTasks(
                groupId,
                req.currentUser.userId
            );

            res.status(200).json({
                status: 'success',
                count: tasks.length,
                tasks
            });

        } catch (error) {
            next(error);
        }
    }
);


// Retrieve task progress history.
router.get(
    '/tasks/:taskId/progress',
    requireAuth,
    requireStudent,
    async (req, res, next) => {
        try {
            const taskId = uuidSchema.parse(req.params.taskId);

            const history = await getTaskProgressHistory(
                taskId,
                req.currentUser.userId
            );

            res.status(200).json({
                status: 'success',
                count: history.length,
                history
            });

        } catch (error) {
            next(error);
        }
    }
);


// Update task progress.
router.patch(
    '/tasks/:taskId/progress',
    requireAuth,
    requireStudent,
    async (req, res, next) => {
        try {
            const taskId = uuidSchema.parse(req.params.taskId);

            const validation = updateProgressSchema.safeParse(req.body);

            if (!validation.success) {
                throw new AppError(
                    'Invalid task progress information.',
                    400
                );
            }

            const progress = await updateTaskProgress(
                taskId,
                req.currentUser.userId,
                validation.data.newStatus,
                validation.data.progressNote
            );

            res.status(200).json({
                status: 'success',
                message: 'Task progress updated successfully.',
                progress
            });

        } catch (error) {
            next(error);
        }
    }
);

export default router;