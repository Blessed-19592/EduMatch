import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { apiErrorHandler } from '../src/middleware/apiErrorHandler.js';

test('maps Zod validation errors to a generic 400 response', () => {
    let validationError;

    try {
        z.string().parse(42);
    } catch (error) {
        validationError = error;
    }

    let responseStatus;
    let responseBody;
    const response = {
        status(status) {
            responseStatus = status;
            return this;
        },
        json(body) {
            responseBody = body;
            return this;
        }
    };

    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        apiErrorHandler(
            validationError,
            { method: 'POST', path: '/api/example' },
            response,
            () => {}
        );
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(responseStatus, 400);
    assert.deepEqual(responseBody, {
        status: 'error',
        message: 'The submitted information is invalid.'
    });
});
