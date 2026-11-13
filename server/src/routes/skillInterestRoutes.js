import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
    getSkillCatalog,
    getInterestCatalog,
    getStudentSkills,
    replaceStudentSkills,
    getStudentInterests,
    replaceStudentInterests,
    getCollaborationIntentions,
    getStudentIntentions,
    replaceStudentIntentions
} from '../services/skillInterestService.js';

const router = express.Router();

router.use(requireStudent);


// ======================================
// VALIDATION SCHEMAS
// ======================================

const proficiencyLevels = [
    'beginner',
    'intermediate',
    'advanced',
    'expert'
];

const skillsSchema = z.object({
    skills: z.array(
        z.object({
            skillId: z.string().uuid(),

            proficiencyLevel: z.enum(proficiencyLevels)
        }).strict()
    ).max(50)
}).strict().superRefine((data, context) => {
    const ids = data.skills.map(skill => skill.skillId);

    if (new Set(ids).size !== ids.length) {
        context.addIssue({
            code: 'custom',
            message: 'Duplicate skills are not allowed.',
            path: ['skills']
        });
    }
});

const interestsSchema = z.object({
    interestIds: z.array(
        z.string().uuid()
    ).max(30)
}).strict().superRefine((data, context) => {
    if (new Set(data.interestIds).size !== data.interestIds.length) {
        context.addIssue({
            code: 'custom',
            message: 'Duplicate interests are not allowed.',
            path: ['interestIds']
        });
    }
});

const intentionsSchema = z.object({
    intentionIds: z.array(z.string().uuid())
        .max(5)
}).strict().refine(
    (data) => new Set(data.intentionIds).size === data.intentionIds.length,
    {
        message: 'Duplicate collaboration intentions are not allowed.',
        path: ['intentionIds']
    }
);
const catalogQuerySchema = z.object({
    search: z.string().trim().max(80).optional(),
    category: z.string().trim().min(1).max(100).optional()
});

const interestCategorySchema = z.enum([
    'academic',
    'technical',
    'creative',
    'professional',
    'research',
    'personal',
    'other'
]);


// ======================================
// GET SKILL CATALOG
// ======================================

router.get('/catalog/skills', async (req, res, next) => {
    try {
        const validation = catalogQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid catalog search parameters.'
            });
        }

        const skills = await getSkillCatalog(validation.data);

        res.status(200).json({
            status: 'success',
            results: skills.length,
            data: skills
        });

    } catch (error) {
        next(error);
    }
});


// ======================================
// GET INTEREST CATALOG
// ======================================

router.get('/catalog/interests', async (req, res, next) => {
    try {
        const validation = catalogQuerySchema.safeParse(req.query);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid catalog search parameters.'
            });
        }

        if (
            validation.data.category &&
            !interestCategorySchema.safeParse(
                validation.data.category
            ).success
        ) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid interest category.'
            });
        }

        const interests = await getInterestCatalog(validation.data);

        res.status(200).json({
            status: 'success',
            results: interests.length,
            data: interests
        });

    } catch (error) {
        next(error);
    }
});


// ======================================
// GET MY SKILLS
// ======================================

router.get('/me/skills', async (req, res, next) => {
    try {
        const skills = await getStudentSkills(
            req.currentUser.userId
        );

        res.status(200).json({
            status: 'success',
            results: skills.length,
            data: skills
        });

    } catch (error) {
        next(error);
    }
});


// ======================================
// REPLACE MY SKILLS
// ======================================

router.put('/me/skills', async (req, res, next) => {
    try {
        const validation = skillsSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid skills information.',
                errors: validation.error.issues
            });
        }

        const skills = await replaceStudentSkills(
            req.currentUser.userId,
            validation.data.skills
        );

        res.status(200).json({
            status: 'success',
            message: 'Skills updated successfully.',
            results: skills.length,
            data: skills
        });

    } catch (error) {
        next(error);
    }
});


// ======================================
// GET MY INTERESTS
// ======================================

router.get('/me/interests', async (req, res, next) => {
    try {
        const interests = await getStudentInterests(
            req.currentUser.userId
        );

        res.status(200).json({
            status: 'success',
            results: interests.length,
            data: interests
        });

    } catch (error) {
        next(error);
    }
});


// ======================================
// REPLACE MY INTERESTS
// ======================================

router.put('/me/interests', async (req, res, next) => {
    try {
        const validation = interestsSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid interests information.',
                errors: validation.error.issues
            });
        }

        const interests = await replaceStudentInterests(
            req.currentUser.userId,
            validation.data.interestIds
        );

        res.status(200).json({
            status: 'success',
            message: 'Interests updated successfully.',
            results: interests.length,
            data: interests
        });

    } catch (error) {
        next(error);
    }
});

// ======================================
// COLLABORATION INTENTIONS
// ======================================

// GET /api/catalog/collaboration-intentions
router.get('/catalog/collaboration-intentions', async (req, res, next) => {
    try {
        const intentions = await getCollaborationIntentions();

        res.status(200).json({
            status: 'success',
            intentions
        });
    } catch (error) {
        next(error);
    }
});


// GET /api/me/intentions
router.get('/me/intentions', async (req, res, next) => {
    try {
        const intentions = await getStudentIntentions(
            req.currentUser.userId
        );

        res.status(200).json({
            status: 'success',
            intentions
        });
    } catch (error) {
        next(error);
    }
});


// PUT /api/me/intentions
router.put('/me/intentions', async (req, res, next) => {
    try {
        const validation = intentionsSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid collaboration intentions.',
                errors: validation.error.issues
            });
        }

        const intentions = await replaceStudentIntentions(
            req.currentUser.userId,
            validation.data.intentionIds
        );

        res.status(200).json({
            status: 'success',
            message: 'Collaboration intentions updated successfully.',
            intentions
        });
    } catch (error) {
        next(error);
    }
});

export default router;