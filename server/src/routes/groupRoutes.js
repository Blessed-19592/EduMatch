import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth.js';
import { requireStudent } from '../middleware/requireRole.js';
import { createGroup } from '../services/groupService.js';

const router = express.Router();

const createGroupSchema = z.object({
    groupName: z.string().trim().min(3).max(100),
    description: z.string().trim().max(3000).optional(),
    maxMembers: z.number().int().min(2).max(20),
    intentionId: z.string().uuid(),
    collaborationTypeId: z.string().uuid(),
    objectives: z.string().trim().min(10).max(5000),
    expectedDeliverables: z.string().trim().min(10).max(5000),
    memberResponsibilities: z.string().trim().min(10).max(5000),
    memberExpectations: z.string().trim().min(10).max(5000),
    requiredSkillIds: z.array(z.string().uuid()).max(50).default([])
}).strict();

// Create a collaboration group.
router.post(
    '/',
    requireAuth,
    requireStudent,
    async (req, res, next) => {
        try {
            const validation = createGroupSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Please correct the group information.',
                    errors: validation.error.issues
                });
            }

            const group = await createGroup(
                req.currentUser.userId,
                validation.data
            );

            res.status(201).json({
                status: 'success',
                message: 'Group created successfully.',
                group
            });

        } catch (error) {
            next(error);
        }
    }
);

export default router;