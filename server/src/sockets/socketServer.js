import { Server } from 'socket.io';
import { z } from 'zod';
import pool from '../config/database.js';

import {
    getGroupChatRoom,
    getGroupChatHistory,
    saveGroupMessage
} from '../services/chatService.js';

const groupIdSchema = z.string().uuid();

const historySchema = z.object({
    groupId: groupIdSchema,
    limit: z.number().int().min(1).max(100).default(50),
    before: z.string().datetime().optional()
});

const messageSchema = z.object({
    groupId: groupIdSchema,
    messageContent: z.string().trim().min(1).max(5000)
});

// Limit each socket to 10 messages per 10 seconds.
const messageTimestamps = new Map();

const canSendMessage = (socketId) => {
    const now = Date.now();
    const windowMs = 10_000;
    const maxMessages = 10;

    const timestamps = (
        messageTimestamps.get(socketId) || []
    ).filter(timestamp => now - timestamp < windowMs);

    if (timestamps.length >= maxMessages) {
        messageTimestamps.set(socketId, timestamps);
        return false;
    }

    timestamps.push(now);
    messageTimestamps.set(socketId, timestamps);

    return true;
};

export const configureSocketServer = (
    httpServer,
    sessionMiddleware
) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true
        }
    });

    // Share Express sessions with Socket.IO.
    io.engine.use(sessionMiddleware);

    // Authenticate socket connections.
    io.use(async (socket, next) => {
        try {
            const userId = socket.request.session?.user?.userId;

            if (!userId) {
                return next(new Error('Authentication required.'));
            }

            const result = await pool.query(
                `SELECT
                    user_id,
                    full_name,
                    role,
                    account_status
                 FROM users
                 WHERE user_id = $1`,
                [userId]
            );

            if (
                result.rows.length === 0 ||
                result.rows[0].account_status !== 'active'
            ) {
                return next(new Error('Account unavailable.'));
            }

            socket.data.user = {
                userId: result.rows[0].user_id,
                fullName: result.rows[0].full_name,
                role: result.rows[0].role
            };

            next();

        } catch (error) {
            console.error('SOCKET AUTH ERROR:', error);
            next(new Error('Socket authentication failed.'));
        }
    });

    // Handle authenticated connections.
    io.on('connection', (socket) => {
        const user = socket.data.user;

        socket.join(`user:${user.userId}`);

        console.log(
            `Authenticated socket connected: ${user.userId}`
        );

        // 1. Join/access a group chat.
        socket.on('group:join', async (data, acknowledge) => {
            try {
                const groupId = groupIdSchema.parse(data?.groupId);

                await getGroupChatRoom(groupId, user.userId);

                acknowledge?.({
                    status: 'success',
                    message: 'Group chat access confirmed.'
                });

            } catch (error) {
                console.error('GROUP JOIN ERROR:', error);

                acknowledge?.({
                    status: 'error',
                    message: 'Unable to access this group chat.'
                });
            }
        });

        // 2. Retrieve group chat history.
        socket.on('group:history', async (data, acknowledge) => {
            try {
                const validated = historySchema.parse(data);

                const messages = await getGroupChatHistory(
                    validated.groupId,
                    user.userId,
                    validated.limit,
                    validated.before || null
                );

                acknowledge?.({
                    status: 'success',
                    messages
                });

            } catch (error) {
                console.error('GROUP HISTORY ERROR:', error);

                acknowledge?.({
                    status: 'error',
                    message: 'Unable to retrieve group messages.'
                });
            }
        });

        // 3. Send and broadcast group messages.
        socket.on('group:message', async (data, acknowledge) => {
            try {
                if (!canSendMessage(socket.id)) {
                    return acknowledge?.({
                        status: 'error',
                        message: 'You are sending messages too quickly.'
                    });
                }

                const validated = messageSchema.parse(data);

                const message = await saveGroupMessage(
                    validated.groupId,
                    user.userId,
                    validated.messageContent
                );

                const broadcastMessage = {
                    ...message,
                    sender_name: user.fullName
                };

                // Retrieve currently active group members.
                const members = await pool.query(
                    `SELECT student_id
                     FROM group_members
                     WHERE group_id = $1
                       AND membership_status = 'active'`,
                    [validated.groupId]
                );

                // Deliver the message to active members.
                for (const member of members.rows) {
                    io.to(`user:${member.student_id}`).emit(
                        'group:new-message',
                        broadcastMessage
                    );
                }

                acknowledge?.({
                    status: 'success',
                    message: broadcastMessage
                });

            } catch (error) {
                console.error('GROUP MESSAGE ERROR:', error);

                acknowledge?.({
                    status: 'error',
                    message: 'Unable to send your message.'
                });
            }
        });

        // Handle disconnection.
        socket.on('disconnect', () => {
            messageTimestamps.delete(socket.id);

            console.log(
                `Socket disconnected: ${user.userId}`
            );
        });
    });

    return io;
};