
import { sendPasswordResetEmail } from './emailService.js';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

import pool from '../config/database.js';

// Complete student registration.
export const completeStudentRegistration = async (
    registrationNumber,
    registrationToken,
    password
) => {
    // Hash the password before storing it.
    const passwordHash = await bcrypt.hash(password, 12);

    // Hash the temporary registration token.
    const tokenHash = crypto
        .createHash('sha256')
        .update(registrationToken)
        .digest('hex');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Find and lock the verified registration token.
        const tokenResult = await client.query(
            `SELECT
                ev.verification_id,
                ev.registry_student_id,
                rs.registration_number,
                rs.full_name,
                rs.university_email,
                rs.year_of_study,
                c.name AS course_name,
                i.name AS institution_name
             FROM email_verification_codes ev
             JOIN registry_students rs
                ON rs.registry_student_id = ev.registry_student_id
             JOIN courses c
                ON c.course_id = rs.course_id
             JOIN departments d
                ON d.department_id = c.department_id
             JOIN faculties f
                ON f.faculty_id = d.faculty_id
             JOIN institutions i
                ON i.institution_id = f.institution_id
             WHERE ev.registration_token_hash = $1
               AND ev.registration_token_expires_at > NOW()
               AND ev.consumed_at IS NULL
               AND ev.verified_at IS NOT NULL
               AND rs.registration_number = $2
               AND rs.student_status = 'active'
             FOR UPDATE OF ev`,
            [tokenHash, registrationNumber.trim().toUpperCase()]
        );

        if (tokenResult.rows.length === 0) {
            throw new Error('Invalid or expired registration token.');
        }

        const student = tokenResult.rows[0];

        // Create the user account.
        const userResult = await client.query(
            `INSERT INTO users (
                full_name,
                email,
                password_hash,
                role,
                email_verified_at,
                registration_number
             )
             VALUES ($1, $2, $3, 'student', NOW(), $4)
             RETURNING user_id`,
            [
                student.full_name,
                student.university_email,
                passwordHash,
                student.registration_number
            ]
        );

        const userId = userResult.rows[0].user_id;

        // Create the student's academic profile.
        await client.query(
            `INSERT INTO student_profiles (
                user_id,
                registry_student_id,
                institution,
                course,
                year_of_study
             )
             VALUES ($1, $2, $3, $4, $5)`,
            [
                userId,
                student.registry_student_id,
                student.institution_name,
                student.course_name,
                student.year_of_study
            ]
        );

        // Consume the registration token.
        await client.query(
            `UPDATE email_verification_codes
             SET consumed_at = NOW()
             WHERE verification_id = $1`,
            [student.verification_id]
        );

        await client.query('COMMIT');

        return {
            message: 'Student account created successfully.',
            userId
        };

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {
        client.release();
    }
};

export const loginStudent = async (registrationNumber, password) => {
    const result = await pool.query(
        `SELECT
            user_id,
            full_name,
            email,
            password_hash,
            role,
            account_status
         FROM users
         WHERE registration_number = $1`,
        [registrationNumber.trim().toUpperCase()]
    );

    if (result.rows.length === 0) {
        throw new Error('Invalid registration number or password.');
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatches || user.account_status !== 'active') {
        throw new Error('Invalid registration number or password.');
    }

    return {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
    };
};

export const requestPasswordReset = async (registrationNumber) => {
    const result = await pool.query(
        `SELECT
            u.user_id,
            u.full_name,
            rs.verification_email
         FROM users u
         JOIN student_profiles sp
            ON sp.user_id = u.user_id
         JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id
         WHERE u.registration_number = $1
           AND u.role = 'student'
           AND u.account_status = 'active'`,
        [registrationNumber.trim().toUpperCase()]
    );

    // Do not reveal whether an account exists.
    if (result.rows.length === 0) {
        return;
    }

    const user = result.rows[0];

    const token = crypto.randomBytes(32).toString('hex');

    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    // Invalidate previous unused reset tokens.
    await pool.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE user_id = $1
           AND used_at IS NULL`,
        [user.user_id]
    );

    await pool.query(
        `INSERT INTO password_reset_tokens (
            user_id,
            token_hash,
            expires_at
         )
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [user.user_id, tokenHash]
    );

    try {
        await sendPasswordResetEmail(
            user.verification_email,
            token
        );
    } catch (error) {
        await pool.query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE token_hash = $1`,
            [tokenHash]
        );

        throw error;
    }
};

export const resetStudentPassword = async (token, newPassword) => {
    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `SELECT reset_id, user_id
             FROM password_reset_tokens
             WHERE token_hash = $1
               AND expires_at > NOW()
               AND used_at IS NULL
             FOR UPDATE`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            throw new Error('Invalid or expired password reset token.');
        }

        const reset = result.rows[0];

        await client.query(
            `UPDATE users
             SET password_hash = $1
             WHERE user_id = $2`,
            [passwordHash, reset.user_id]
        );

        await client.query(
            `UPDATE password_reset_tokens
             SET used_at = NOW()
             WHERE reset_id = $1`,
            [reset.reset_id]
        );

        // Invalidate all existing login sessions for this user.
        await client.query(
            `DELETE FROM user_sessions
             WHERE sess::jsonb -> 'user' ->> 'userId' = $1`,
            [reset.user_id]
        );

        await client.query('COMMIT');

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {
        client.release();
    }
};