import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';
import {
    getUserSettings,
    updateUserSettings
} from '../services/settingsService.js';

const router = express.Router();

const settingsSchema = z.object({
    theme: z.enum(['light', 'dark']).optional(),
    profileDiscoverable: z.boolean().optional(),
    notifyCollaborationRequests: z.boolean().optional(),
    notifyGroupInvitations: z.boolean().optional(),
    notifyMembershipUpdates: z.boolean().optional(),
    notifyMessages: z.boolean().optional()
}).strict().refine(
    (settings) => Object.keys(settings).length > 0,
    { message: 'Provide at least one setting to update.' }
);

router.use(requireStudent);

router.get('/', async (req, res, next) => {
    try {
        const settings = await getUserSettings(req.currentUser.userId);

        return res.status(200).json({
            status: 'success',
            data: { settings }
        });
    } catch (error) {
        return next(error);
    }
});

router.patch('/', async (req, res, next) => {
    try {
        const validation = settingsSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Provide valid settings to update.',
                errors: validation.error.issues
            });
        }

        const settings = await updateUserSettings(
            req.currentUser.userId,
            validation.data
        );

        return res.status(200).json({
            status: 'success',
            message: 'Settings saved successfully.',
            data: { settings }
        });
    } catch (error) {
        return next(error);
    }
});

export default router;
