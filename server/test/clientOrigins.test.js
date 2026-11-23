import assert from 'node:assert/strict';
import test from 'node:test';
import { getClientOrigins } from '../src/config/clientOrigins.js';

test('allows localhost alongside the configured LAN origin in development', () => {
    const origins = getClientOrigins(
        'http://192.168.1.100:5173',
        false
    );

    assert.deepEqual(
        [...origins].sort(),
        [
            'http://192.168.1.100:5173',
            'http://localhost:5173'
        ]
    );
});

test('does not add the localhost alias in production', () => {
    const origins = getClientOrigins(
        'https://edumatch.example',
        true
    );

    assert.deepEqual([...origins], ['https://edumatch.example']);
});
