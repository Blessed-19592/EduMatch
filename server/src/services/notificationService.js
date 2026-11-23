import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export const getUserNotifications = async (userId) => {
    const [notificationsResult, unreadResult] = await Promise.all([
        pool.query(
            `SELECT
                notification_id,
                notification_type,
                group_id,
                entity_id,
                target_page,
                title,
                body,
                created_at,
                read_at
             FROM user_notifications
             WHERE recipient_id = $1
             ORDER BY created_at DESC, notification_id DESC
             LIMIT 50`,
            [userId]
        ),
        pool.query(
            `SELECT COUNT(*)::int AS unread_count
             FROM user_notifications
             WHERE recipient_id = $1
               AND read_at IS NULL`,
            [userId]
        )
    ]);

    return {
        notifications: notificationsResult.rows,
        unreadCount: unreadResult.rows[0].unread_count
    };
};

export const markUserNotificationRead = async (userId, notificationId) => {
    const result = await pool.query(
        `UPDATE user_notifications
         SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE notification_id = $1
           AND recipient_id = $2
         RETURNING notification_id, read_at`,
        [notificationId, userId]
    );

    if (result.rows.length === 0) {
        throw new AppError('Notification not found.', 404);
    }

    return result.rows[0];
};

export const markAllUserNotificationsRead = async (userId) => {
    await pool.query(
        `UPDATE user_notifications
         SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_id = $1
           AND read_at IS NULL`,
        [userId]
    );
};
