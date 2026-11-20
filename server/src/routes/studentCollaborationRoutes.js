import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
    sendStudentCollaborationRequest,
    getStudentCollaborationRequests,
    respondToStudentCollaborationRequest,
    cancelStudentCollaborationRequest
} from '../services/studentCollaborationService.js';

const router = express.Router();

router.use(requireStudent);

const sendRequestSchema = z.object({
    message: z.string().trim().min(10).max(1000)
});

const responseSchema = z.object({
    decision: z.enum(['accepted', 'declined'])
});


// Send a request to another student.
router.post('/:studentId', async (req, res, next) => {
    try {
        const validation = sendRequestSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide a message between 10 and 1000 characters.'
            });
        }

        const request = await sendStudentCollaborationRequest(
            req.currentUser.userId,
            req.params.studentId,
            validation.data.message
        );

        res.status(201).json({
            status: 'success',
            message: 'Collaboration request sent successfully.',
            data: request
        });

    } catch (error) {
        next(error);
    }
});


// Get sent or received requests.
router.get('/', async (req, res, next) => {
    try {
        const type = req.query.type || 'received';

        if (!['sent', 'received'].includes(type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Request type must be sent or received.'
            });
        }

        const requests = await getStudentCollaborationRequests(
            req.currentUser.userId,
            type
        );

        res.status(200).json({
            status: 'success',
            data: requests
        });

    } catch (error) {
        next(error);
    }
});


// Accept or decline a received request.
router.patch('/:requestId/respond', async (req, res, next) => {
    try {
        const validation = responseSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Decision must be accepted or declined.'
            });
        }

        const request = await respondToStudentCollaborationRequest(
            req.params.requestId,
            req.currentUser.userId,
            validation.data.decision
        );

        res.status(200).json({
            status: 'success',
            message: `Collaboration request ${validation.data.decision}.`,
            data: request
        });

    } catch (error) {
        next(error);
    }
});


// Cancel a request sent by the current student.
router.patch('/:requestId/cancel', async (req, res, next) => {
    try {
        const request = await cancelStudentCollaborationRequest(
            req.params.requestId,
            req.currentUser.userId
        );

        res.status(200).json({
            status: 'success',
            message: 'Collaboration request cancelled.',
            data: request
        });

    } catch (error) {
        next(error);
    }
});

export default router;