import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
    getStudentMatches,
    getGroupMatches
} from '../services/matchingService.js';

const router = express.Router();

router.use(requireStudent);

const matchingQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict();

// GET /api/matches/students
router.get('/students', async (req, res, next) => {
    try {
        const validation = matchingQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                message: 'Invalid matching query parameters.',
                errors: validation.error.flatten()
            });
        }

        const matches = await getStudentMatches(
            req.currentUser.userId,
            validation.data
        );

        return res.status(200).json({
            message: 'Student recommendations retrieved successfully.',
            count: matches.length,
            matches
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/matches/groups
router.get('/groups', async (req, res, next) => {
    try {
        const validation = matchingQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                message: 'Invalid matching query parameters.',
                errors: validation.error.flatten()
            });
        }

        const matches = await getGroupMatches(
            req.currentUser.userId,
            validation.data
        );

        return res.status(200).json({
            message: 'Group recommendations retrieved successfully.',
            count: matches.length,
            matches
        });
    } catch (error) {
        next(error);
    }
});

export default router;