import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordResetUrl } from '../src/utils/passwordResetUrl.js';

test('creates a reset link recognized by the reset page', () => {
    const token = 'a'.repeat(64);
    const resetUrl = new URL(
        createPasswordResetUrl(token, 'https://edumatch.example')
    );

    assert.equal(resetUrl.origin, 'https://edumatch.example');
    assert.equal(resetUrl.pathname, '/reset-password');
    assert.equal(resetUrl.searchParams.get('token'), token);
});
