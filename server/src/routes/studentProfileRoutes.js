import { getPublicStudentProfile } from '../services/publicProfileService.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';
import { parsePictureUpload } from '../middleware/parsePictureUpload.js';

import {
    getStudentProfile,
    updateStudentProfile
} from '../services/profileService.js';
import {
    getStudentProfilePicture,
    uploadStudentProfilePicture
} from '../services/profilePictureService.js';
import { AppError } from '../utils/AppError.js';

import {
    getStudentPartnerPreferences,
    replaceStudentPartnerPreferences
} from '../services/skillInterestService.js';

const router = express.Router();
const uuidSchema = z.string().uuid();
const pictureMetadataSchema = z.object({
    name: z.string().trim().min(1).max(255),
    type: z.string().trim().max(100).optional()
}).strict();
const profilePictureUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: req => String(req.currentUser.userId),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Too many picture uploads. Please wait before trying again.'
    }
});


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

const partnerPreferencesSchema = z.object({
    preferredExperienceLevel: z.enum([
        'beginner',
        'intermediate',
        'advanced',
        'expert',
        'any'
    ]),

    preferredCommitmentLevel: z.enum([
        'flexible',
        'moderate',
        'high',
        'any'
    ]),

    preferredWorkingStyle: z.enum([
        'independent',
        'collaborative',
        'structured',
        'flexible',
        'any'
    ]),

    additionalPreferences: z.string()
        .trim()
        .max(1000)
        .nullable(),

    preferredSkillIds: z.array(z.string().uuid()).max(50),

    preferredFacultyIds: z.array(z.string().uuid()).max(20),

    preferredDepartmentIds: z.array(z.string().uuid()).max(50),

    preferredCourseIds: z.array(z.string().uuid()).max(50)

}).strict().superRefine((data, context) => {
    const fields = [
        'preferredSkillIds',
        'preferredFacultyIds',
        'preferredDepartmentIds',
        'preferredCourseIds'
    ];

    for (const field of fields) {
        if (new Set(data[field]).size !== data[field].length) {
            context.addIssue({
                code: 'custom',
                message: `Duplicate entries are not allowed in ${field}.`,
                path: [field]
            });
        }
    }
});

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

router.post(
    '/me/profile-picture',
    profilePictureUploadLimiter,
    parsePictureUpload,
    async (req, res, next) => {
        try {
            const metadata = pictureMetadataSchema.parse(req.query);

            if (!Buffer.isBuffer(req.body)) {
                throw new AppError('Upload the image as binary data.', 400);
            }

            const picture = await uploadStudentProfilePicture(
                req.currentUser.userId,
                req.body,
                metadata.name,
                metadata.type
            );

            return res.status(200).json({
                status: 'success',
                message: 'Profile picture uploaded successfully.',
                data: picture
            });
        } catch (error) {
            return next(error);
        }
    }
);

router.get('/:studentId/profile-picture', async (req, res, next) => {
    try {
        const validation = uuidSchema.safeParse(req.params.studentId);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid student profile ID.'
            });
        }

        const picture = await getStudentProfilePicture(
            validation.data,
            req.currentUser.userId
        );

        res.set({
            'Cache-Control': 'private, no-store',
            'Content-Type': picture.mimeType,
            'Content-Disposition': 'inline',
            'X-Content-Type-Options': 'nosniff'
        });

        return res.sendFile(picture.filePath, error => {
            if (error) next(error);
        });
    } catch (error) {
        return next(error);
    }
});

// ======================================
// VIEW ANOTHER STUDENT'S PUBLIC PROFILE
// ======================================

router.get('/:studentId/profile', async (req, res, next) => {
    try {
        const validation = z.string().uuid().safeParse(
            req.params.studentId
        );

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid student profile ID.'
            });
        }

        const profile = await getPublicStudentProfile(
            validation.data
        );

        return res.status(200).json({
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

// ======================================
// GET MY PARTNER PREFERENCES
// ======================================

router.get('/me/partner-preferences', async (req, res, next) => {
    try {
        const preferences = await getStudentPartnerPreferences(
            req.currentUser.userId
        );

        res.status(200).json({
            status: 'success',
            data: preferences
        });

    } catch (error) {
        next(error);
    }
});


// ======================================
// UPDATE MY PARTNER PREFERENCES
// ======================================

router.put('/me/partner-preferences', async (req, res, next) => {
    try {
        const validation = partnerPreferencesSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid partner preferences.',
                errors: validation.error.issues
            });
        }

        const preferences = await replaceStudentPartnerPreferences(
            req.currentUser.userId,
            validation.data
        );

        res.status(200).json({
            status: 'success',
            message: 'Partner preferences updated successfully.',
            data: preferences
        });

    } catch (error) {
        next(error);
    }
});

export default router;