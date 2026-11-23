import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from '../utils/chatAttachmentValidation.js';

// Get or create a group's chat room.
export const getGroupChatRoom = async (groupId, userId) => {
    await pool.query(
        `INSERT INTO chat_rooms (group_id)
         SELECT $1
         WHERE EXISTS (
             SELECT 1
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
               AND membership_status = 'active'
         )
         ON CONFLICT (group_id) DO NOTHING`,
        [groupId, userId]
    );

    const result = await pool.query(
        `SELECT cr.room_id, cr.group_id
         FROM chat_rooms cr
         JOIN group_members gm
            ON gm.group_id = cr.group_id
         WHERE cr.group_id = $1
           AND gm.student_id = $2
           AND gm.membership_status = 'active'`,
        [groupId, userId]
    );

    if (result.rows.length === 0) {
        throw new AppError('You are not an active member of this group.', 403);
    }

    return result.rows[0];
};


// Retrieve group chat history.
export const getGroupChatHistory = async (
    groupId,
    userId,
    limit = 50,
    before = null
) => {
    const room = await getGroupChatRoom(groupId, userId);

    const result = await pool.query(
        `SELECT
            cm.message_id,
            cm.room_id,
            cm.sender_id,
            cm.message_content,
            cm.created_at,
            u.full_name AS sender_name,
            cr.group_id,
            COALESCE(
                json_agg(
                    json_build_object(
                        'attachment_id', a.attachment_id,
                        'original_filename', a.original_filename,
                        'mime_type', a.mime_type,
                        'size_bytes', a.size_bytes
                    )
                    ORDER BY a.created_at
                ) FILTER (WHERE a.attachment_id IS NOT NULL),
                '[]'::json
            ) AS attachments
         FROM chat_messages cm
         JOIN users u ON u.user_id = cm.sender_id
         JOIN chat_rooms cr ON cr.room_id = cm.room_id
         LEFT JOIN chat_message_attachments a
           ON a.message_id = cm.message_id
         WHERE cm.room_id = $1
           AND ($2::timestamptz IS NULL OR cm.created_at < $2)
           AND EXISTS (
               SELECT 1
               FROM group_members gm
               WHERE gm.group_id = $3
                 AND gm.student_id = $4
                 AND gm.membership_status = 'active'
           )
         GROUP BY cm.message_id, u.full_name, cr.group_id
         ORDER BY cm.created_at DESC, cm.message_id DESC
         LIMIT $5`,
        [room.room_id, before, groupId, userId, limit]
    );

    return result.rows.reverse();
};


// Save a group message.
export const saveGroupMessage = async (
    groupId,
    userId,
    messageContent,
    attachmentIds = []
) => {
    const content = String(messageContent || '').trim();

    if (content.length > 5000) {
        throw new AppError('Messages cannot exceed 5,000 characters.', 400);
    }

    if (attachmentIds.length > MAX_CHAT_ATTACHMENTS_PER_MESSAGE) {
        throw new AppError(
            `A message can include up to ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} attachments.`,
            400
        );
    }

    if (!content && attachmentIds.length === 0) {
        throw new AppError('Write a message or attach at least one file.', 400);
    }

    if (new Set(attachmentIds).size !== attachmentIds.length) {
        throw new AppError('An attachment cannot be added more than once.', 400);
    }

    const room = await getGroupChatRoom(groupId, userId);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (attachmentIds.length > 0) {
            const pendingAttachments = await client.query(
                `SELECT attachment_id
                 FROM chat_message_attachments
                 WHERE attachment_id = ANY($1::uuid[])
                   AND group_id = $2
                   AND uploaded_by = $3
                   AND message_id IS NULL
                   AND pending_expires_at > CURRENT_TIMESTAMP
                 FOR UPDATE`,
                [attachmentIds, groupId, userId]
            );

            if (pendingAttachments.rows.length !== attachmentIds.length) {
                throw new AppError(
                    'One or more attachments are unavailable. Please remove and upload them again.',
                    400
                );
            }
        }

        const messageResult = await client.query(
            `INSERT INTO chat_messages (
                room_id,
                sender_id,
                message_content
             )
             VALUES ($1, $2, $3)
             RETURNING
                message_id,
                room_id,
                sender_id,
                message_content,
                created_at`,
            [room.room_id, userId, content || null]
        );

        let attachments = [];

        if (attachmentIds.length > 0) {
            const attachmentResult = await client.query(
                `UPDATE chat_message_attachments
                 SET message_id = $1,
                     pending_expires_at = NULL
                 WHERE attachment_id = ANY($2::uuid[])
                   AND group_id = $3
                   AND uploaded_by = $4
                   AND message_id IS NULL
                 RETURNING
                    attachment_id,
                    original_filename,
                    mime_type,
                    size_bytes`,
                [
                    messageResult.rows[0].message_id,
                    attachmentIds,
                    groupId,
                    userId
                ]
            );

            if (attachmentResult.rows.length !== attachmentIds.length) {
                throw new AppError(
                    'One or more attachments could not be added to the message.',
                    409
                );
            }

            attachments = attachmentResult.rows;
        }

        await client.query('COMMIT');

        return {
            ...messageResult.rows[0],
            group_id: groupId,
            attachments
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};