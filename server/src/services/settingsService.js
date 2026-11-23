import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const settingColumns = {
    theme: 'theme',
    profileDiscoverable: 'profile_discoverable',
    notifyCollaborationRequests: 'notify_collaboration_requests',
    notifyGroupInvitations: 'notify_group_invitations',
    notifyMembershipUpdates: 'notify_membership_updates',
    notifyMessages: 'notify_messages'
};

const toSettings = (row) => ({
    theme: row.theme,
    profileDiscoverable: row.profile_discoverable,
    notifyCollaborationRequests: row.notify_collaboration_requests,
    notifyGroupInvitations: row.notify_group_invitations,
    notifyMembershipUpdates: row.notify_membership_updates,
    notifyMessages: row.notify_messages
});

export const getUserSettings = async (userId) => {
    await pool.query(
        `INSERT INTO user_settings (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
    );

    const result = await pool.query(
        `SELECT
            theme,
            profile_discoverable,
            notify_collaboration_requests,
            notify_group_invitations,
            notify_membership_updates,
            notify_messages
         FROM user_settings
         WHERE user_id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        throw new AppError('Settings could not be loaded.', 500);
    }

    return toSettings(result.rows[0]);
};

export const updateUserSettings = async (userId, settings) => {
    const entries = Object.entries(settings).filter(([key]) =>
        Object.hasOwn(settingColumns, key)
    );

    if (entries.length === 0) {
        throw new AppError('No settings changes were provided.', 400);
    }

    const columns = entries.map(([key]) => settingColumns[key]);
    const values = [userId, ...entries.map(([, value]) => value)];
    const insertColumns = columns.join(', ');
    const placeholders = entries.map((_, index) => `$${index + 2}`).join(', ');
    const updates = columns
        .map((column) => `${column} = EXCLUDED.${column}`)
        .concat('updated_at = NOW()')
        .join(', ');

    const result = await pool.query(
        `INSERT INTO user_settings (user_id, ${insertColumns})
         VALUES ($1, ${placeholders})
         ON CONFLICT (user_id)
         DO UPDATE SET ${updates}
         RETURNING
            theme,
            profile_discoverable,
            notify_collaboration_requests,
            notify_group_invitations,
            notify_membership_updates,
            notify_messages`,
        values
    );

    return toSettings(result.rows[0]);
};
