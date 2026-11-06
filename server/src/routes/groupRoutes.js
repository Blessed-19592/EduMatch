import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth.js';
import { requireStudent } from '../middleware/requireRole.js';

import {
    createGroup,
    discoverGroups,
    getGroupDetails,
    submitMembershipRequest,
    getGroupMembershipRequests,
    respondToMembershipRequest
} from '../services/groupService.js';

const router = express.Router();

const uuidSchema = z.string().uuid();

const createGroupSchema = z.object({
    groupName: z.string().trim().min(3).max(100),
    description: z.string().trim().max(3000).optional(),
    maxMembers: z.number().int().min(2).max(20),
    intentionId: uuidSchema,
    collaborationTypeId: uuidSchema,
    objectives: z.string().trim().min(10).max(5000),
    expectedDeliverables: z.string().trim().min(10).max(5000),
    memberResponsibilities: z.string().trim().min(10).max(5000),
    memberExpectations: z.string().trim().min(10).max(5000),
    requiredSkillIds: z.array(uuidSchema).max(50).default([])
}).strict();


// ======================================
// CREATE GROUP
// ======================================

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


// ======================================
// DISCOVER GROUPS
// ======================================

router.get(
    '/',
    requireAuth,
    requireStudent,
    async (req, res, next) => {
        try {
            const scopeSchema = z.enum([
                'course',
                'department',
                'school',
                'university'
            ]);

            const validation = scopeSchema.safeParse(
                req.query.scope || 'university'
            );

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid discovery scope.'
                });
            }

            const groups = await discoverGroups(
                req.currentUser.userId,
                validation.data
            );

            res.status(200).json({
                status: 'success',
                count: groups.length,
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
    requireAuth,
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

            res.status(200).json({
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
    requireAuth,
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

            res.status(201).json({
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
    requireAuth,
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

            res.status(200).json({
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
    requireAuth,
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

            res.status(200).json({
                status: 'success',
                message: `Membership request ${bodyValidation.data.decision}.`,
                request
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;