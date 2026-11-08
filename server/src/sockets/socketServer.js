
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
}).strict();

const messageSchema = z.object({
    groupId: groupIdSchema,
    messageContent: z.string().trim().min(1).max(5000)
}).strict();


// ======================================
// SOCKET AUTHENTICATION ERRORS
// ======================================

class SocketAuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SocketAuthorizationError';
    }
}


// ======================================
// MESSAGE RATE LIMITING
// ======================================

// Maximum 10 messages per user every 10 seconds.
// This applies across multiple sockets belonging
// to the same user within this server instance.

const messageTimestamps = new Map();

const canSendMessage = (userId) => {
    const now = Date.now();
    const windowMs = 10_000;
    const maxMessages = 10;

    const timestamps = (
        messageTimestamps.get(userId) || []
    ).filter(timestamp => now - timestamp < windowMs);

    if (timestamps.length >= maxMessages) {
        messageTimestamps.set(userId, timestamps);
        return false;
    }

    timestamps.push(now);
    messageTimestamps.set(userId, timestamps);

    return true;
};


// ======================================
// REFRESH AND VERIFY SOCKET SESSION
// ======================================

const refreshSocketSession = async (socket) => {
    const session = socket.request.session;

    if (!session || typeof session.reload !== 'function') {
        throw new SocketAuthorizationError(
            'Authentication required.'
        );
    }

    // Reload the session from the session store.
    // This detects expired or destroyed sessions.
    await new Promise((resolve, reject) => {
        session.reload((error) => {
            if (error) {
                reject(
                    new SocketAuthorizationError(
                        'Your session has expired.'
                    )
                );
            } else {
                resolve();
            }
        });
    });

    const sessionUserId = socket.request.session?.user?.userId;

    if (
        !sessionUserId ||
        sessionUserId !== socket.data.user.userId
    ) {
        throw new SocketAuthorizationError(
            'Authentication required.'
        );
    }

    // Verify the user's current database status and role.
    const result = await pool.query(
        `SELECT
            user_id,
            full_name,
            role,
            account_status
         FROM users
         WHERE user_id = $1`,
        [sessionUserId]
    );

    if (
        result.rows.length === 0 ||
        result.rows[0].account_status !== 'active' ||
        result.rows[0].role !== 'student'
    ) {
        throw new SocketAuthorizationError(
            'Your account is unavailable.'
        );
    }

    // Refresh socket user information.
    socket.data.user = {
        userId: result.rows[0].user_id,
        fullName: result.rows[0].full_name,
        role: result.rows[0].role
    };

    return socket.data.user;
};


// ======================================
// CONFIGURE SOCKET.IO
// ======================================

export const configureSocketServer = (
    httpServer,
    sessionMiddleware
) => {
    const allowedOrigin = process.env.CLIENT_URL;

    const io = new Server(httpServer, {
        cors: {
            origin: allowedOrigin,
            credentials: true
        },

        // Validate browser origins during connection.
        // Non-browser clients such as Postman may
        // connect without an Origin header.
        allowRequest: (req, callback) => {
            const origin = req.headers.origin;

            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigin && origin === allowedOrigin) {
                return callback(null, true);
            }

            return callback('Origin not allowed.', false);
        }
    });

    // Share Express sessions with Socket.IO.
    io.engine.use(sessionMiddleware);


    // ======================================
    // INITIAL SOCKET AUTHENTICATION
    // ======================================

    io.use(async (socket, next) => {
        try {
            const userId = socket.request.session?.user?.userId;

            if (!userId) {
                return next(
                    new Error('Authentication required.')
                );
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
                return next(
                    new Error('Account unavailable.')
                );
            }

            if (result.rows[0].role !== 'student') {
                return next(
                    new Error('Student access required.')
                );
            }

            socket.data.user = {
                userId: result.rows[0].user_id,
                fullName: result.rows[0].full_name,
                role: result.rows[0].role
            };

            next();

        } catch (error) {
            console.error('SOCKET AUTH ERROR:', error);

            next(
                new Error('Socket authentication failed.')
            );
        }
    });


    // ======================================
    // AUTHENTICATED CONNECTIONS
    // ======================================

    io.on('connection', (socket) => {
        const user = socket.data.user;

        // Every authenticated user gets a private room.
        socket.join(`user:${user.userId}`);

        console.log(
            `Authenticated socket connected: ${user.userId}`
        );


        // ======================================
        // SHARED EVENT AUTHORIZATION
        // ======================================

        const handleAuthorizedEvent = (
            eventName,
            handler
        ) => {
            socket.on(eventName, async (data, acknowledge) => {
                try {
                    // Revalidate session and account.
                    const currentUser = await refreshSocketSession(
                        socket
                    );

                    await handler(
                        data,
                        acknowledge,
                        currentUser
                    );

                } catch (error) {
                    if (error instanceof SocketAuthorizationError) {
                        console.warn(
                            `SOCKET AUTHORIZATION FAILED (${eventName}):`,
                            error.message
                        );

                        acknowledge?.({
                            status: 'error',
                            message: 'Your session is invalid or expired. Please log in again.'
                        });

                        socket.disconnect(true);

                        return;
                    }

                    console.error(
                        `${eventName.toUpperCase()} ERROR:`,
                        error
                    );

                    acknowledge?.({
                        status: 'error',
                        message: 'Unable to complete this operation.'
                    });
                }
            });
        };


        // ======================================
        // 1. GROUP CHAT ACCESS
        // ======================================

        handleAuthorizedEvent(
            'group:join',
            async (data, acknowledge, currentUser) => {
                const groupId = groupIdSchema.parse(
                    data?.groupId
                );

                // Confirms that the student is an active
                // member before granting chat access.
                await getGroupChatRoom(
                    groupId,
                    currentUser.userId
                );

                acknowledge?.({
                    status: 'success',
                    message: 'Group chat access confirmed.'
                });
            }
        );


        // ======================================
        // 2. RETRIEVE CHAT HISTORY
        // ======================================

        handleAuthorizedEvent(
            'group:history',
            async (data, acknowledge, currentUser) => {
                const validated = historySchema.parse(data);

                const messages = await getGroupChatHistory(
                    validated.groupId,
                    currentUser.userId,
                    validated.limit,
                    validated.before || null
                );

                acknowledge?.({
                    status: 'success',
                    messages
                });
            }
        );


        // ======================================
        // 3. SEND AND BROADCAST MESSAGES
        // ======================================

        handleAuthorizedEvent(
            'group:message',
            async (data, acknowledge, currentUser) => {

                // Apply rate limiting per user.
                if (!canSendMessage(currentUser.userId)) {
                    return acknowledge?.({
                        status: 'error',
                        message: 'You are sending messages too quickly.'
                    });
                }

                const validated = messageSchema.parse(data);

                // The chat service independently checks
                // active group membership before saving.
                const message = await saveGroupMessage(
                    validated.groupId,
                    currentUser.userId,
                    validated.messageContent
                );

                const broadcastMessage = {
                    ...message,
                    sender_name: currentUser.fullName
                };

                // Retrieve CURRENTLY active group members.
                // This prevents messages from being sent
                // to students who have been removed.
                const members = await pool.query(
                    `SELECT student_id
                     FROM group_members
                     WHERE group_id = $1
                       AND membership_status = 'active'`,
                    [validated.groupId]
                );

                // Deliver only to current active members.
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
            }
        );


        // ======================================
        // 4. DISCONNECTION
        // ======================================

        socket.on('disconnect', () => {

            // Remove rate-limit data only when this
            // user has no remaining local connections.
            const remainingSockets = io.sockets.adapter.rooms.get(
                `user:${user.userId}`
            );

            if (!remainingSockets || remainingSockets.size === 0) {
                messageTimestamps.delete(user.userId);
            }

            console.log(
                `Socket disconnected: ${user.userId}`
            );
        });
    });

    return io;
};
