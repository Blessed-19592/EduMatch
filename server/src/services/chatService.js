import pool from '../config/database.js';

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
        throw new Error('You are not an active member of this group.');
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
            u.full_name AS sender_name
         FROM chat_messages cm
         JOIN users u ON u.user_id = cm.sender_id
         WHERE cm.room_id = $1
           AND ($2::timestamptz IS NULL OR cm.created_at < $2)
           AND EXISTS (
               SELECT 1
               FROM group_members gm
               WHERE gm.group_id = $3
                 AND gm.student_id = $4
                 AND gm.membership_status = 'active'
           )
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
    messageContent
) => {
    const content = messageContent.trim();

    if (!content || content.length > 5000) {
        throw new Error(
            'Messages must contain between 1 and 5000 characters.'
        );
    }

    const room = await getGroupChatRoom(groupId, userId);

    const result = await pool.query(
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
        [room.room_id, userId, content]
    );

    return result.rows[0];
};