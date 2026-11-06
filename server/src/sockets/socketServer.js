import { Server } from 'socket.io';
import pool from '../config/database.js';

export const configureSocketServer = (httpServer, sessionMiddleware) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true
        }
    });

    // Share Express sessions with Socket.IO.
    io.engine.use(sessionMiddleware);

    // Authenticate every socket connection.
    io.use(async (socket, next) => {
        try {
            const userId = socket.request.session?.user?.userId;

            if (!userId) {
                return next(new Error('Authentication required.'));
            }

            const result = await pool.query(
                `SELECT user_id, full_name, role, account_status
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
            next(new Error('Socket authentication failed.'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`Authenticated socket connected: ${socket.data.user.userId}`);

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.data.user.userId}`);
        });
    });

    return io;
};