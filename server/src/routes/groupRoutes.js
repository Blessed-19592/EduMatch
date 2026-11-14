
import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
    createGroup,
    discoverGroups,
    getGroupDetails,
    submitMembershipRequest,
    getGroupMembershipRequests,
    respondToMembershipRequest
    leaveGroup
} from '../services/groupService.js';

const router = express.Router();

const uuidSchema = z.string().uuid();

const academicYearSchema = z.number().int().min(1).max(4);

// ======================================
// CREATE GROUP VALIDATION
// ======================================

const createGroupSchema = z.object({
    groupName: z.string().trim().min(3).max(100),

    description: z.string().trim().max(3000).optional(),

    maxMembers: z.number().int().min(2).max(15),

    intentionId: uuidSchema,

    objectives: z.string().trim().min(10).max(5000),

    expectedDeliverables: z.string().trim().min(10).max(5000),

    memberResponsibilities: z.string().trim().min(10).max(5000),

    memberExpectations: z.string().trim().min(10).max(5000),

    requiredSkillIds: z.array(uuidSchema).max(50).default([]),

    acceptsAllYears: z.boolean().default(true),

    allowedYears: z.array(academicYearSchema).max(4).default([])

}).strict()

.superRefine((data, ctx) => {
    const uniqueYears = new Set(data.allowedYears);

    if (uniqueYears.size !== data.allowedYears.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['allowedYears'],
            message: 'An academic year cannot be selected more than once.'
        });
    }

    if (data.acceptsAllYears && data.allowedYears.length > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['allowedYears'],
            message: 'Allowed years must be empty when accepting all years.'
        });
    }

    if (!data.acceptsAllYears && data.allowedYears.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['allowedYears'],
            message: 'Select at least one academic year.'
        });
    }
})

.transform(data => {
    // Selecting all four individual years is equivalent to All Years.

    if (data.allowedYears.length === 4) {
        return {
            ...data,
            acceptsAllYears: true,
            allowedYears: []
        };
    }

    return data;
});


// ======================================
// GROUP DISCOVERY FILTER VALIDATION
// ======================================

const discoveryScopeSchema = z.enum([
    'course',
    'department',
    'school',
    'university'
]);

const memberYearsSchema = z.preprocess(value => {
    if (value === undefined || value === '') {
        return [];
    }

    let values;

    if (Array.isArray(value)) {
        values = value;
    } else {
        values = String(value).split(',');
    }

    return values.map(year => {
        if (typeof year === 'number') {
            return year;
        }

        if (!/^[1-4]$/.test(String(year).trim())) {
            return Number.NaN;
        }

        return Number(year);
    });

}, z.array(academicYearSchema).max(4))

.transform(years => [...new Set(years)]);


// ======================================
// CREATE GROUP
// ======================================

router.post(
    '/',
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

            return res.status(201).json({
                status: 'success',
                message: 'Group created successfully.',
                group
            });

        } catch (error) {
            next(error);
        }
    }
);


// ======================================
// DISCOVER GROUPS
// ======================================

router.get(
    '/',
    requireStudent,
    async (req, res, next) => {
        try {
            const scopeValidation = discoveryScopeSchema.safeParse(
                req.query.scope || 'course'
            );

            if (!scopeValidation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid discovery scope.'
                });
            }

            const yearsValidation = memberYearsSchema.safeParse(
                req.query.memberYears
            );

            if (!yearsValidation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid academic year filter. Select years between 1 and 4.',
                    errors: yearsValidation.error.issues
                });
            }

            const groups = await discoverGroups(
                req.currentUser.userId,
                scopeValidation.data,
                yearsValidation.data
            );

            return res.status(200).json({
                status: 'success',
                count: groups.length,
                filters: {
                    scope: scopeValidation.data,
                    memberYears: yearsValidation.data
                },
                groups
            });

        } catch (error) {
            next(error);
        }
    }
);


// ======================================
// VIEW GROUP DETAILS
// ======================================

router.get(
    '/:groupId',
    requireStudent,
    async (req, res, next) => {
        try {
            const validation = uuidSchema.safeParse(req.params.groupId);

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid group ID.'
                });
            }

            const group = await getGroupDetails(
                validation.data,
                req.currentUser.userId
            );

            return res.status(200).json({
                status: 'success',
                group
            });

        } catch (error) {
            next(error);
        }
    }
);


// ======================================
// REQUEST TO JOIN GROUP
// ======================================

router.post(
    '/:groupId/requests',
    requireStudent,
    async (req, res, next) => {
        try {
            const groupValidation = uuidSchema.safeParse(
                req.params.groupId
            );

            const bodyValidation = z.object({
                message: z.string().trim().max(1000).optional()
            }).strict().safeParse(req.body);

            if (!groupValidation.success || !bodyValidation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid membership request information.'
                });
            }

            const request = await submitMembershipRequest(
                groupValidation.data,
                req.currentUser.userId,
                bodyValidation.data.message
            );

            return res.status(201).json({
                status: 'success',
                message: 'Membership request submitted.',
                request
            });

        } catch (error) {
            next(error);
        }
    }
);


// ======================================
// VIEW GROUP MEMBERSHIP REQUESTS
// ======================================

router.get(
    '/:groupId/requests',
    requireStudent,
    async (req, res, next) => {
        try {
            const validation = uuidSchema.safeParse(req.params.groupId);

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid group ID.'
                });
            }

            const requests = await getGroupMembershipRequests(
                validation.data,
                req.currentUser.userId
            );

            return res.status(200).json({
                status: 'success',
                count: requests.length,
                requests
            });

        } catch (error) {
            next(error);
        }
    }
);


// ======================================
// ACCEPT OR REJECT MEMBERSHIP REQUEST
// ======================================

router.patch(
    '/requests/:requestId',
    requireStudent,
    async (req, res, next) => {
        try {
            const idValidation = uuidSchema.safeParse(
                req.params.requestId
            );

            const bodyValidation = z.object({
                decision: z.enum(['accepted', 'rejected'])
            }).strict().safeParse(req.body);

            if (!idValidation.success || !bodyValidation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid request information.'
                });
            }

            const request = await respondToMembershipRequest(
                idValidation.data,
                req.currentUser.userId,
                bodyValidation.data.decision
            );

            return res.status(200).json({
                status: 'success',
                message: `Membership request ${bodyValidation.data.decision}.`,
                request
            });

        } catch (error) {
            next(error);
        }
    }
);

// ======================================
// LEAVE GROUP
// ======================================

router.delete(
    '/:groupId/membership',
    requireStudent,
    async (req, res, next) => {
        try {
            const validation = uuidSchema.safeParse(req.params.groupId);

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid group ID.'
                });
            }

            const result = await leaveGroup(
                req.currentUser.userId,
                validation.data
            );

            return res.status(200).json({
                status: 'success',
                ...result
            });

        } catch (error) {
            next(error);
        }
    }
);
export default router;
