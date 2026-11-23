import { ZodError } from 'zod';

export const apiErrorHandler = (error, req, res, next) => {
    console.error('API ERROR:', {
        method: req.method,
        path: req.path,
        error: error.message,
        code: error.code
    });

    let statusCode = error.statusCode || 500;
    let message = error.message || 'An unexpected error occurred.';

    if (error instanceof ZodError) {
        statusCode = 400;
        message = 'The submitted information is invalid.';
    } else if (error.code === '23505') {
        statusCode = 409;
        message = 'This record already exists.';
    } else if (['23503', '23514', '22P02'].includes(error.code)) {
        statusCode = 400;
        message = 'The submitted information is invalid.';
    } else if (error.code === 'P0001') {
        statusCode = 409;
        message = 'The requested operation conflicts with current group conditions.';
    }

    if (statusCode >= 500) {
        message = 'An unexpected server error occurred.';
    }

    res.status(statusCode).json({
        status: 'error',
        message
    });
};
