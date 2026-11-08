
import express from 'express';
import { z } from 'zod';

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


// ======================================
// CREATE GROUP TASK
// ======================================

router.post(
    '/:groupId/tasks',
    requireStudent,
    async (req, res, next) => {
        try {
            const groupIdValidation = uuidSchema.safeParse(
                req.params.groupId
            );

            if (!groupIdValidation.success) {
                throw new AppError('Invalid group ID.', 400);
            }

            const validation = createTaskSchema.safeParse(req.body);

            if (!validation.success) {
                throw new AppError('Invalid task information.', 400);
            }

            const task = await createGroupTask(
                groupIdValidation.data,
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


// ======================================
// RETRIEVE GROUP TASKS
// ======================================

router.get(
    '/:groupId/tasks',
    requireStudent,
    async (req, res, next) => {
        try {
            const groupIdValidation = uuidSchema.safeParse(
                req.params.groupId
            );

            if (!groupIdValidation.success) {
                throw new AppError('Invalid group ID.', 400);
            }

            const tasks = await getGroupTasks(
                groupIdValidation.data,
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


// ======================================
// RETRIEVE TASK PROGRESS HISTORY
// ======================================

router.get(
    '/tasks/:taskId/progress',
    requireStudent,
    async (req, res, next) => {
        try {
            const taskIdValidation = uuidSchema.safeParse(
                req.params.taskId
            );

            if (!taskIdValidation.success) {
                throw new AppError('Invalid task ID.', 400);
            }

            const history = await getTaskProgressHistory(
                taskIdValidation.data,
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


// ======================================
// UPDATE TASK PROGRESS
// ======================================

router.patch(
    '/tasks/:taskId/progress',
    requireStudent,
    async (req, res, next) => {
        try {
            const taskIdValidation = uuidSchema.safeParse(
                req.params.taskId
            );

            if (!taskIdValidation.success) {
                throw new AppError('Invalid task ID.', 400);
            }

            const validation = updateProgressSchema.safeParse(req.body);

            if (!validation.success) {
                throw new AppError(
                    'Invalid task progress information.',
                    400
                );
            }

            const progress = await updateTaskProgress(
                taskIdValidation.data,
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
