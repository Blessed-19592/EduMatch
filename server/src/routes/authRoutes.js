
import { requireAuth } from '../middleware/requireAuth.js';
import {
    completeStudentRegistration,
    loginStudent
} from '../services/authService.js';
import express from 'express';

import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import {
    requestStudentVerification,
    verifyStudentCode
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

const loginSchema = z.object({
    registrationNumber: z.string().trim().min(3).max(50),
    password: z.string().min(10).max(72),
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

// Verify the student's email code.
router.post(
    '/register/verify-code',
    verificationLimiter,
    async (req, res) => {
        try {
            const schema = z.object({
                registrationNumber: z.string()
                    .trim()
                    .min(3)
                    .max(50),

                code: z.string()
                    .regex(/^\d{6}$/, 'Code must contain six digits.')
            });

            const validation = schema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Provide a valid registration number and six-digit code.'
                });
            }

            const result = await verifyStudentCode(
                validation.data.registrationNumber,
                validation.data.code
            );

            return res.status(200).json({
                status: 'success',
                message: result.message,
                registrationToken: result.registrationToken
            });

        } catch (error) {
            console.error('Code verification failed:', error.message);

            return res.status(400).json({
                status: 'error',
                message: 'Invalid or expired verification code.'
            });
        }
    }
);

// Complete student registration.
router.post(
    '/register/complete',
    async (req, res) => {
        try {
            const schema = z.object({
                registrationNumber: z.string()
                    .trim()
                    .min(3)
                    .max(50),

                registrationToken: z.string()
                    .regex(/^[a-f0-9]{64}$/),

                password: z.string()
                    .min(10, 'Password must contain at least 10 characters.')
                    .max(72, 'Password is too long.')
            });

            const validation = schema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Please provide valid registration details and a password of at least 10 characters.'
                });
            }

            const result = await completeStudentRegistration(
                validation.data.registrationNumber,
                validation.data.registrationToken,
                validation.data.password
            );

            return res.status(201).json({
                status: 'success',
                message: result.message,
                userId: result.userId
            });

        } catch (error) {
            console.error('Registration failed:', error.message);

            if (error.code === '23505') {
                return res.status(409).json({
                    status: 'error',
                    message: 'An account already exists for this student.'
                });
            }

            return res.status(400).json({
                status: 'error',
                message: 'Registration could not be completed. Please verify your details or request a new verification code.'
            });
        }
    }
);

router.post('/login', async (req, res) => {
    try {
        const validation = loginSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide valid login details.',
            });
        }

        const { registrationNumber, password } = validation.data;

        const user = await loginStudent(registrationNumber, password);

        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Unable to establish a login session.',
                });
            }

            req.session.user = user;

            req.session.save((saveError) => {
                if (saveError) {
                    return res.status(500).json({
                        status: 'error',
                        message: 'Unable to establish a login session.',
                    });
                }

                return res.status(200).json({
                    status: 'success',
                    message: 'Login successful.',
                    user,
                });
            });
        });

    } catch (error) {
        console.error('Login failed:', error.message);

        res.status(401).json({
            status: 'error',
            message: 'Invalid registration number or password.',
        });
    }
});

router.get('/me', requireAuth, (req, res) => {
    res.status(200).json({
        status: 'success',
        user: req.session.user,
    });
});
export default router;