
import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
    getStudentMatches,
    getGroupMatches
} from '../services/matchingService.js';

const router = express.Router();

router.use(requireStudent);

// ======================================
// MATCHING QUERY VALIDATION
// ======================================

const matchingQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),

    years: z.preprocess(value => {
        if (value === undefined || value === '') {
            return [];
        }

        const values = Array.isArray(value)
            ? value
            : String(value).split(',');

        return values.map(year => {
            const normalized = String(year).trim();

            if (!/^[1-4]$/.test(normalized)) {
                return Number.NaN;
            }

            return Number(normalized);
        });

    }, z.array(
        z.number().int().min(1).max(4)
    ).max(4).default([]))

}).strict()

.superRefine((data, ctx) => {
    if (new Set(data.years).size !== data.years.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['years'],
            message: 'An academic year cannot be selected more than once.'
        });
    }
})

.transform(data => ({
    ...data,
    years: [...new Set(data.years)]
}));


// ======================================
// GET STUDENT MATCHES
// ======================================

// GET /api/matches/students

router.get('/students', async (req, res, next) => {
    try {
        const validation = matchingQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid matching query parameters.',
                errors: validation.error.issues
            });
        }

        const matches = await getStudentMatches(
            req.currentUser.userId,
            validation.data
        );

        return res.status(200).json({
            status: 'success',
            message: 'Student recommendations retrieved successfully.',
            count: matches.length,

            filters: {
                limit: validation.data.limit,
                years: validation.data.years
            },

            matches
        });

    } catch (error) {
        next(error);
    }
});


// ======================================
// GET GROUP MATCHES
// ======================================

// GET /api/matches/groups

router.get('/groups', async (req, res, next) => {
    try {
        const validation = matchingQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid matching query parameters.',
                errors: validation.error.issues
            });
        }

        const matches = await getGroupMatches(
            req.currentUser.userId,
            {
                limit: validation.data.limit
            }
        );

        return res.status(200).json({
            status: 'success',
            message: 'Group recommendations retrieved successfully.',
            count: matches.length,

            filters: {
                limit: validation.data.limit
            },

            matches
        });

    } catch (error) {
        next(error);
    }
});

export default router;
