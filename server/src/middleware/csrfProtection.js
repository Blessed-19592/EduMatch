import { timingSafeEqual } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection = (req, res, next) => {
    // Safe HTTP methods do not change application state.
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    const sessionToken = req.session?.csrfToken;
    const requestToken = req.get('X-CSRF-Token');

    if (
        typeof sessionToken !== 'string' ||
        typeof requestToken !== 'string'
    ) {
        return res.status(403).json({
            status: 'error',
            message: 'Invalid or missing CSRF token.'
        });
    }

    // Tokens must be 64 hexadecimal characters.
    const tokenPattern = /^[a-f0-9]{64}$/;

    if (
        !tokenPattern.test(sessionToken) ||
        !tokenPattern.test(requestToken)
    ) {
        return res.status(403).json({
            status: 'error',
            message: 'Invalid or missing CSRF token.'
        });
    }

    const expected = Buffer.from(sessionToken, 'hex');
    const received = Buffer.from(requestToken, 'hex');

    if (!timingSafeEqual(expected, received)) {
        return res.status(403).json({
            status: 'error',
            message: 'Invalid or missing CSRF token.'
        });
    }

    next();
};