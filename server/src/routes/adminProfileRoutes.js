import express from 'express';
import { z } from 'zod';

import { requireAdmin } from '../middleware/requireRole.js';
import {
    approveAllSubmittedStudentProfiles,
    getAdminProfiles,
    moderateStudentProfile,
    reviewStudentProfile
} from '../services/adminProfileService.js';

const router = express.Router();
const studentIdSchema = z.string().uuid();

const profileQuerySchema = z.object({
    status: z.enum(['submitted', 'approved', 'hidden']).default('submitted'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0)
}).strict();

const reviewSchema = z.object({
    action: z.enum(['approve', 'request_changes']),
    notes: z.string().trim().min(10).max(1000).nullable().optional()
}).strict().superRefine((data, context) => {
    if (data.action === 'request_changes' && !data.notes) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['notes'],
            message: 'A reason is required when requesting changes.'
        });
    }
});

const moderationSchema = z.object({
    action: z.enum(['hide', 'restore']),
    notes: z.string().trim().min(10).max(1000)
}).strict();

router.use(requireAdmin);

router.get('/profiles', async (req, res, next) => {
    try {
        const validation = profileQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid profile queue query.',
                errors: validation.error.issues
            });
        }

        const result = await getAdminProfiles(validation.data);

        return res.status(200).json({
            status: 'success',
            ...result
        });
    } catch (error) {
        return next(error);
    }
});

router.post('/profiles/review/approve-all', async (req, res, next) => {
    try {
        const result = await approveAllSubmittedStudentProfiles(
            req.currentUser.userId
        );

        return res.status(200).json({
            status: 'success',
            message: `Approved ${result.approvedCount} submitted student ${
                result.approvedCount === 1 ? 'profile' : 'profiles'
            }.`,
            data: result
        });
    } catch (error) {
        return next(error);
    }
});

router.post('/profiles/:studentId/review', async (req, res, next) => {
    try {
        const studentId = studentIdSchema.safeParse(req.params.studentId);
        const validation = reviewSchema.safeParse(req.body);

        if (!studentId.success || !validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid profile review decision.',
                errors: [
                    ...studentId.error?.issues ?? [],
                    ...validation.error?.issues ?? []
                ]
            });
        }

        const result = await reviewStudentProfile(
            req.currentUser.userId,
            studentId.data,
            validation.data
        );

        return res.status(200).json({
            status: 'success',
            message: validation.data.action === 'approve'
                ? 'Student profile approved.'
                : 'Changes requested from the student.',
            data: result
        });
    } catch (error) {
        return next(error);
    }
});

router.post('/profiles/:studentId/moderation', async (req, res, next) => {
    try {
        const studentId = studentIdSchema.safeParse(req.params.studentId);
        const validation = moderationSchema.safeParse(req.body);

        if (!studentId.success || !validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid profile moderation action.',
                errors: [
                    ...studentId.error?.issues ?? [],
                    ...validation.error?.issues ?? []
                ]
            });
        }

        const result = await moderateStudentProfile(
            req.currentUser.userId,
            studentId.data,
            validation.data
        );

        return res.status(200).json({
            status: 'success',
            message: validation.data.action === 'hide'
                ? 'Student profile hidden from discovery.'
                : 'Student profile restored to discovery.',
            data: result
        });
    } catch (error) {
        return next(error);
    }
});

export default router;
