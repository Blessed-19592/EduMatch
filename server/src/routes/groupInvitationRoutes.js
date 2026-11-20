import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
    getGroupInvitations,
    respondToGroupInvitation,
    cancelGroupInvitation
} from '../services/groupInvitationService.js';

const router = express.Router();

router.use(requireStudent);


// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const uuidSchema = z.string().uuid();

const responseSchema = z.object({
    decision: z.enum(['accepted', 'declined'])
});


// =====================================================
// GET RECEIVED OR SENT INVITATIONS
// GET /api/group-invitations?type=received
// =====================================================

router.get('/', async (req, res, next) => {
    try {
        const querySchema = z.object({
            type: z.enum(['received', 'sent']).default('received')
        });

        const { type } = querySchema.parse(req.query);

        const invitations = await getGroupInvitations(
            req.currentUser.userId,
            type
        );

        res.status(200).json({
            status: 'success',
            results: invitations.length,
            data: { invitations }
        });

    } catch (error) {
        next(error);
    }
});


// =====================================================
// ACCEPT OR DECLINE AN INVITATION
// PATCH /api/group-invitations/:invitationId/respond
// =====================================================

router.patch('/:invitationId/respond', async (req, res, next) => {
    try {
        const invitationId = uuidSchema.parse(req.params.invitationId);
        const { decision } = responseSchema.parse(req.body);

        const invitation = await respondToGroupInvitation(
            invitationId,
            req.currentUser.userId,
            decision
        );

        res.status(200).json({
            status: 'success',
            message: `Invitation ${decision} successfully.`,
            data: { invitation }
        });

    } catch (error) {
        next(error);
    }
});


// =====================================================
// CANCEL A PENDING INVITATION
// PATCH /api/group-invitations/:invitationId/cancel
// =====================================================

router.patch('/:invitationId/cancel', async (req, res, next) => {
    try {
        const invitationId = uuidSchema.parse(req.params.invitationId);

        const invitation = await cancelGroupInvitation(
            invitationId,
            req.currentUser.userId
        );

        res.status(200).json({
            status: 'success',
            message: 'Invitation cancelled successfully.',
            data: { invitation }
        });

    } catch (error) {
        next(error);
    }
});

export default router;