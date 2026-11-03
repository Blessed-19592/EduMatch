import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import {
    requestStudentVerification
} from '../services/verificationService.js';

const router = express.Router();

// Limit verification requests to prevent email abuse.
const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Too many requests. Please try again later.'
    }
});

// Validate registration number.
const registrationSchema = z.object({
    registrationNumber: z.string()
        .trim()
        .min(3)
        .max(50)
});

// Request an email verification code.
router.post(
    '/register/request-code',
    verificationLimiter,
    async (req, res) => {
        try {
            const validation = registrationSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Please provide a valid registration number.'
                });
            }

            await requestStudentVerification(
                validation.data.registrationNumber
            );

            return res.status(200).json({
                status: 'success',
                message: 'If the registration details are eligible, a verification code will be sent.'
            });

        } catch (error) {
            console.error('Verification request failed:', error.message);

            return res.status(400).json({
                status: 'error',
                message: 'Unable to process your request. Please check your details or try again later.'
            });
        }
    }
);

export default router;