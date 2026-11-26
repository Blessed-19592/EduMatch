
import studentCollaborationRoutes from './routes/studentCollaborationRoutes.js';
import matchingRoutes from './routes/matchingRoutes.js';
import assessmentEvidenceRoutes from './routes/assessmentEvidenceRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import skillInterestRoutes from './routes/skillInterestRoutes.js';
import studentProfileRoutes from './routes/studentProfileRoutes.js';
import dotenv from 'dotenv';
dotenv.config();
import groupInvitationRoutes from './routes/groupInvitationRoutes.js';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

import taskRoutes from './routes/taskRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import chatAttachmentRoutes from './routes/chatAttachmentRoutes.js';
import authRoutes from './routes/authRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminProfileRoutes from './routes/adminProfileRoutes.js';

import { configureSocketServer } from './sockets/socketServer.js';

import { csrfProtection } from './middleware/csrfProtection.js';
import { apiErrorHandler } from './middleware/apiErrorHandler.js';

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import pool from './config/database.js';
import { getClientOrigins } from './config/clientOrigins.js';


// ======================================
// ENVIRONMENT VALIDATION
// ======================================

const requiredEnvironmentVariables = [
    'CLIENT_URL',
    'SESSION_SECRET',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
];

const isProduction = process.env.NODE_ENV === 'production';

for (const variable of requiredEnvironmentVariables) {
    if (!process.env[variable]) {
        throw new Error(
            `Missing required environment variable: ${variable}`
        );
    }
}

if (Buffer.byteLength(process.env.SESSION_SECRET, 'utf8') < 32) {
    throw new Error(
        'SESSION_SECRET must contain at least 32 bytes.'
    );
}

let allowedOrigin;

try {
    const parsedOrigin = new URL(process.env.CLIENT_URL);

    if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
        throw new Error('Invalid protocol.');
    }

    allowedOrigin = parsedOrigin.origin;

} catch {
    throw new Error(
        'CLIENT_URL must be a valid frontend origin.'
    );
}

const allowedOrigins = getClientOrigins(allowedOrigin, isProduction);


// ======================================
// APPLICATION INITIALIZATION
// ======================================

const app = express();

const httpServer = createServer(app);

const PgSession = connectPgSimple(session);

const PORT = Number(process.env.PORT) || 5000;

if (isProduction) {
    app.set('trust proxy', 1);
}


// ======================================
// SESSION STORE
// ======================================

const sessionStore = new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
});


// ======================================
// SECURITY MIDDLEWARE
// ======================================

app.disable('x-powered-by');

app.use(helmet());


// Validate browser origins for state-changing requests.

app.use((req, res, next) => {
    const origin = req.headers.origin;

    const safeMethods = [
        'GET',
        'HEAD',
        'OPTIONS'
    ];

    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Allow requests from Postman and server-to-server clients.
    // CSRF token validation still applies to these requests.

    if (!origin) {
        return next();
    }

    if (!allowedOrigins.has(origin)) {
        return res.status(403).json({
            status: 'error',
            message: 'Request origin not allowed.'
        });
    }

    next();
});


// ======================================
// CORS CONFIGURATION
// ======================================

app.use(cors({
    origin: [...allowedOrigins],
    credentials: true,
    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],
    allowedHeaders: [
        'Content-Type',
        'X-CSRF-Token'
    ]
}));


// ======================================
// REQUEST BODY LIMITS
// ======================================

app.use(express.json({
    limit: '10kb'
}));


// ======================================
// SESSION CONFIGURATION
// ======================================

const sessionMiddleware = session({
    name: 'edumatch_sid',

    store: sessionStore,

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    cookie: {
        httpOnly: true,

        secure: isProduction,

        sameSite: 'lax',

        maxAge: 8 * 60 * 60 * 1000
    }
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

    message: {
        status: 'error',
        message: 'Too many requests. Please try again later.'
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 30,

    standardHeaders: 'draft-8',

    legacyHeaders: false,

    message: {
        status: 'error',
        message: 'Too many authentication requests. Please try again later.'
    }
});

app.use('/api', generalLimiter);

// ======================================
// HEALTH CHECK
// ======================================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'EduMatch API is running.'
    });
});

// ======================================
// DATABASE CONNECTION CHECK
// ======================================

app.get('/api/db-health', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT
                current_database() AS database,
                NOW() AS server_time`
        );

        res.status(200).json({
            status: 'success',
            message: 'Database connection successful.',
            database: result.rows[0].database,
            serverTime: result.rows[0].server_time
        });

    } catch (error) {
        next(error);
    }
});

app.use('/api/auth', authLimiter);


// ======================================
// CSRF TOKEN GENERATION
// ======================================

// Generate a random token tied to the current session.
// The token must be retrieved before state-changing requests.

app.get('/api/auth/csrf-token', (req, res, next) => {

    if (!req.session.csrfToken) {
        req.session.csrfToken = randomBytes(32).toString('hex');
    }

    // Prevent browsers and intermediaries from caching the token.
    res.set('Cache-Control', 'no-store');

    req.session.save((error) => {

        if (error) {
            return next(error);
        }

        res.status(200).json({
            status: 'success',
            csrfToken: req.session.csrfToken
        });

    });
});


// ======================================
// CSRF PROTECTION
// ======================================

// Every state-changing API request must provide
// the CSRF token belonging to its session.

app.use('/api', csrfProtection);


// ======================================
// API ROUTES
// ======================================

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminProfileRoutes);

app.use('/api/groups', groupRoutes);
app.use('/api/groups', chatAttachmentRoutes);
app.use('/api/group-invitations', groupInvitationRoutes);
app.use('/api/groups', taskRoutes);
app.use('/api/students', studentProfileRoutes);
app.use('/api', skillInterestRoutes);
app.use('/api/students', portfolioRoutes);
app.use('/api/students', assessmentEvidenceRoutes);
app.use('/api/matches', matchingRoutes);
app.use('/api/student-collaboration-requests', studentCollaborationRoutes);





// ======================================
// 404 HANDLER
// ======================================

app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'The requested endpoint does not exist.'
    });
});


// ======================================
// CENTRALIZED ERROR HANDLER
// ======================================

app.use(apiErrorHandler);


// ======================================
// SOCKET.IO INITIALIZATION
// ======================================

configureSocketServer(
    httpServer,
    sessionMiddleware,
    allowedOrigins
);


// ======================================
// START SERVER
// ======================================

httpServer.listen(PORT, () => {
    console.log(
        `EduMatch server running on port ${PORT}`
    );

    console.log(
        `Environment: ${process.env.NODE_ENV || 'development'}`
    );
});