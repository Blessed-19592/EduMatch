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

const uuidSchema = z.string().uuid();


// Send a collaboration request to another student.
router.post('/:studentId', async (req, res, next) => {
    try {
        const studentIdValidation = uuidSchema.safeParse(req.params.studentId);

        if (!studentIdValidation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid student ID.'
            });
        }

        const validation = sendRequestSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide a message between 10 and 1000 characters.'
            });
        }

        const request = await sendStudentCollaborationRequest(
            req.currentUser.userId,
            studentIdValidation.data,
            validation.data.message
        );

        return res.status(201).json({
            status: 'success',
            message: 'Collaboration request sent successfully.',
            data: request
        });

    } catch (error) {
        next(error);
    }
});


// Get sent or received collaboration requests.
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

        return res.status(200).json({
            status: 'success',
            data: requests
        });

    } catch (error) {
        next(error);
    }
});


// Accept or decline a received collaboration request.
router.patch('/:requestId/respond', async (req, res, next) => {
    try {
        const requestIdValidation = uuidSchema.safeParse(req.params.requestId);

        if (!requestIdValidation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid request ID.'
            });
        }

        const validation = responseSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Decision must be accepted or declined.'
            });
        }

        const request = await respondToStudentCollaborationRequest(
            requestIdValidation.data,
            req.currentUser.userId,
            validation.data.decision
        );

        return res.status(200).json({
            status: 'success',
            message: `Collaboration request ${validation.data.decision}.`,
            data: request
        });

    } catch (error) {
        next(error);
    }
});


// Cancel a pending request sent by the current student.
router.patch('/:requestId/cancel', async (req, res, next) => {
    try {
        const requestIdValidation = uuidSchema.safeParse(req.params.requestId);

        if (!requestIdValidation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid request ID.'
            });
        }

        const request = await cancelStudentCollaborationRequest(
            requestIdValidation.data,
            req.currentUser.userId
        );

        return res.status(200).json({
            status: 'success',
            message: 'Collaboration request cancelled.',
            data: request
        });

    } catch (error) {
        next(error);
    }
});

export default router;