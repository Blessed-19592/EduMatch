import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
    getStudentProfile,
    updateStudentProfile
} from '../services/profileService.js';

const router = express.Router();


// All routes require an active student account.

router.use(requireStudent);


// ======================================
// VALIDATION
// ======================================

const profileUpdateSchema = z.object({

    bio: z.string()
        .trim()
        .max(1000)
        .nullable()
        .optional(),

    profilePictureUrl: z.string()
        .url()
        .refine(
            value => ['http:', 'https:'].includes(new URL(value).protocol),
            'Profile picture URL must use HTTP or HTTPS.'
        )
        .nullable()
        .optional(),

    collaborationStatus: z.enum([
        'available',
        'currently_collaborating',
        'unavailable'
    ]).optional(),

    availabilityHoursPerWeek: z.number()
        .int()
        .min(1)
        .max(168)
        .nullable()
        .optional(),

    preferredMeetingMode: z.enum([
        'remote',
        'in_person',
        'hybrid',
        'any'
    ]).optional(),

    preferredMeetingTimes: z.array(
        z.string().trim().min(1).max(100)
    ).max(20).optional(),

    commitmentLevel: z.enum([
        'flexible',
        'moderate',
        'high'
    ]).optional()

}).strict();


// ======================================
// GET MY PROFILE
// ======================================

router.get('/me/profile', async (req, res, next) => {

    try {

        const profile = await getStudentProfile(
            req.currentUser.userId
        );

        res.status(200).json({
            status: 'success',
            data: profile
        });

    } catch (error) {

        next(error);

    }

});


// ======================================
// UPDATE MY PROFILE
// ======================================

router.patch('/me/profile', async (req, res, next) => {

    try {

        const validation = profileUpdateSchema.safeParse(req.body);

        if (!validation.success) {

            return res.status(400).json({
                status: 'error',
                message: 'Invalid profile information.',
                errors: validation.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }))
            });

        }

        const profile = await updateStudentProfile(
            req.currentUser.userId,
            validation.data
        );

        res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully.',
            data: profile
        });

    } catch (error) {

        next(error);

    }

});


export default router;