
import { createServer } from 'node:http';
import { configureSocketServer } from './sockets/socketServer.js';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import authRoutes from './routes/authRoutes.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import pool from './config/database.js';

dotenv.config();

const app = express();

const PgSession = connectPgSimple(session);

const sessionStore = new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
});

const PORT = process.env.PORT || 5000;

// ======================================
// SECURITY MIDDLEWARE
// ======================================

app.use(helmet());

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));

app.use(express.json({
    limit: '10kb',
}));

const sessionMiddleware = session({
    name: 'edumatch_sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
    },
});

app.use(sessionMiddleware);

// ======================================
// RATE LIMITING
// ======================================

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
});

app.use('/api', generalLimiter);
app.use('/api/auth', authRoutes);
// ======================================
// HEALTH CHECK
// ======================================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'EduMatch API is running.',
    });
});

// ======================================
// DATABASE CONNECTION CHECK
// ======================================

app.get('/api/db-health', async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT current_database() AS database, NOW() AS server_time'
        );

        res.status(200).json({
            status: 'success',
            message: 'Database connection successful.',
            database: result.rows[0].database,
            serverTime: result.rows[0].server_time,
        });

    } catch (error) {
        next(error);
    }
});

// ======================================
// 404 HANDLER
// ======================================

app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'The requested endpoint does not exist.',
    });
});

// ======================================
// CENTRALIZED ERROR HANDLER
// ======================================

app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        status: 'error',
        message: 'An unexpected server error occurred.',
    });
});

// ======================================
// START SERVER
// ======================================

const httpServer = createServer(app);

configureSocketServer(httpServer, sessionMiddleware);

httpServer.listen(PORT, () => {
    console.log(`EduMatch server running on port ${PORT}`);
});