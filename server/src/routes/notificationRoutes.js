import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';
import {
    getUserNotifications,
    markAllUserNotificationsRead,
    markUserNotificationRead
} from '../services/notificationService.js';

const router = express.Router();
const uuidSchema = z.string().uuid();

router.use(requireStudent);

router.get('/', async (req, res, next) => {
    try {
        const data = await getUserNotifications(req.currentUser.userId);

        return res.status(200).json({
            status: 'success',
            data
        });
    } catch (error) {
        return next(error);
    }
});

router.patch('/read-all', async (req, res, next) => {
    try {
        await markAllUserNotificationsRead(req.currentUser.userId);

        return res.status(200).json({
            status: 'success',
            message: 'Notifications marked as read.'
        });
    } catch (error) {
        return next(error);
    }
});

router.patch('/:notificationId/read', async (req, res, next) => {
    try {
        const validation = uuidSchema.safeParse(req.params.notificationId);

        if (!validation.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid notification ID.'
            });
        }

        const notification = await markUserNotificationRead(
            req.currentUser.userId,
            validation.data
        );

        return res.status(200).json({
            status: 'success',
            data: { notification }
        });
    } catch (error) {
        return next(error);
    }
});

export default router;
