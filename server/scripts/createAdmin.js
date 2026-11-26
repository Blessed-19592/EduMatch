import bcrypt from 'bcrypt';
import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import pool from '../src/config/database.js';

const nameSchema = z.string().trim().min(2).max(150);
const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(12).max(72);

const ask = async (prompt) => {
    const interfaceInstance = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        return await interfaceInstance.question(prompt);
    } finally {
        interfaceInstance.close();
    }
};

const askSecret = async (prompt) => {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY || typeof input.setRawMode !== 'function') {
        throw new Error(
            'Admin provisioning must be run from an interactive terminal.'
        );
    }

    return new Promise((resolve, reject) => {
        let value = '';

        const restoreTerminal = () => {
            input.removeListener('data', handleInput);
            input.setRawMode(false);
            input.pause();
            output.write('\n');
        };

        const handleInput = (chunk) => {
            for (const character of chunk) {
                if (character === '\u0003' || character === '\u0004') {
                    restoreTerminal();
                    reject(new Error('Admin provisioning was cancelled.'));
                    return;
                }

                if (character === '\r' || character === '\n') {
                    restoreTerminal();
                    resolve(value);
                    return;
                }

                if (character === '\u007f' || character === '\b') {
                    if (value.length > 0) {
                        value = value.slice(0, -1);
                        output.write('\b \b');
                    }
                    continue;
                }

                if (character >= ' ') {
                    value += character;
                    output.write('*');
                }
            }
        };

        output.write(prompt);
        input.setRawMode(true);
        input.setEncoding('utf8');
        input.resume();
        input.on('data', handleInput);
    });
};

const main = async () => {
    let client;

    try {
        if (!process.stdin.isTTY) {
            throw new Error(
                'Run this command directly in an interactive terminal.'
            );
        }

        const fullNameResult = nameSchema.safeParse(
            (await ask('Staff full name: ')).trim()
        );
        if (!fullNameResult.success) {
            throw new Error('Name must contain 2 to 150 characters.');
        }

        const emailResult = emailSchema.safeParse(
            (await ask('Verified staff email: ')).trim()
        );
        if (!emailResult.success) {
            throw new Error('Enter a valid staff email address.');
        }

        const email = emailResult.data.toLowerCase();
        const password = await askSecret('Choose admin password (12+ characters): ');
        const passwordResult = passwordSchema.safeParse(password);
        if (
            !passwordResult.success ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            throw new Error(
                'Admin password must contain at least 12 characters and no more than 72 UTF-8 bytes.'
            );
        }

        const confirmation = await askSecret('Confirm admin password: ');
        if (password !== confirmation) {
            throw new Error('The passwords do not match.');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        client = await pool.connect();
        await client.query('BEGIN');

        const existing = await client.query(
            `SELECT user_id
             FROM users
             WHERE LOWER(email) = LOWER($1)
             FOR UPDATE`,
            [email]
        );

        if (existing.rows.length > 0) {
            throw new Error(
                'An account already uses this email. No account was changed; this command never promotes existing users.'
            );
        }

        const result = await client.query(
            `INSERT INTO users (
                full_name,
                email,
                password_hash,
                role,
                account_status,
                email_verified_at
             )
             VALUES ($1, $2, $3, 'admin', 'active', NOW())
             RETURNING user_id`,
            [fullNameResult.data, email, passwordHash]
        );

        await client.query('COMMIT');
        console.log(`Created a separate administrator account for ${email}.`);
        console.log('Sign in with this staff email and the password you entered.');
        console.log(`Administrator ID: ${result.rows[0].user_id}`);
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK').catch(() => {});
        }

        if (error.code === '23505') {
            console.error('An account already uses this email. No account was changed.');
        } else {
            console.error(error.message);
        }

        process.exitCode = 1;
    } finally {
        client?.release();
        await pool.end();
    }
};

await main();
