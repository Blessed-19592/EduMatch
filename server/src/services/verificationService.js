import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

import pool from '../config/database.js';
import { sendVerificationEmail } from './emailService.js';

// Generate and send a verification code.
export const requestStudentVerification = async (registrationNumber) => {
    // Find the student in the university registry.
    const studentResult = await pool.query(
        `SELECT registry_student_id, verification_email
         FROM registry_students
         WHERE registration_number = $1
         AND student_status = 'active'`,
        [registrationNumber.trim().toUpperCase()]
    );

    if (studentResult.rows.length === 0) {
        throw new Error('Unable to process this registration request.');
    }

    const student = studentResult.rows[0];

    if (!student.verification_email) {
        throw new Error('Unable to process this registration request.');
    }

    // Generate a random six-digit code.
    const code = crypto.randomInt(100000, 1000000).toString();

    // Hash the code before storing it.
    const codeHash = await bcrypt.hash(code, 12);

    // Invalidate previous unused codes.
    await pool.query(
        `DELETE FROM email_verification_codes
         WHERE registry_student_id = $1
         AND verified_at IS NULL`,
        [student.registry_student_id]
    );

    // Store the new code with a 10-minute expiry.
    await pool.query(
        `INSERT INTO email_verification_codes
         (registry_student_id, code_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
        [student.registry_student_id, codeHash]
    );

    try {
        // Send the code to the registered testing inbox.
        await sendVerificationEmail(
            student.verification_email,
            code
        );
    } catch (error) {
        // Remove the unusable code if email delivery fails.
        await pool.query(
            `DELETE FROM email_verification_codes
             WHERE registry_student_id = $1
             AND verified_at IS NULL`,
            [student.registry_student_id]
        );

        throw error;
    }

    return {
        message: 'Verification code sent successfully.'
    };
};

// Verify the student's email verification code.
export const verifyStudentCode = async (registrationNumber, submittedCode) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Find the student.
        const studentResult = await client.query(
            `SELECT registry_student_id
             FROM registry_students
             WHERE registration_number = $1
             AND student_status = 'active'`,
            [registrationNumber.trim().toUpperCase()]
        );

        if (studentResult.rows.length === 0) {
            throw new Error('Invalid or expired verification code.');
        }

        const studentId = studentResult.rows[0].registry_student_id;

        // Lock the latest unused verification code.
        const codeResult = await client.query(
            `SELECT verification_id, code_hash, expires_at, attempts
             FROM email_verification_codes
             WHERE registry_student_id = $1
             AND verified_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [studentId]
        );

        if (codeResult.rows.length === 0) {
            throw new Error('Invalid or expired verification code.');
        }

        const verification = codeResult.rows[0];

        if (
            new Date(verification.expires_at) <= new Date() ||
            verification.attempts >= 5
        ) {
            throw new Error('Invalid or expired verification code.');
        }

        // Count this attempt before checking the submitted code.
        await client.query(
            `UPDATE email_verification_codes
             SET attempts = attempts + 1
             WHERE verification_id = $1`,
            [verification.verification_id]
        );

        const isValid = await bcrypt.compare(
            submittedCode,
            verification.code_hash
        );

        if (!isValid) {
            await client.query('COMMIT');

            throw new Error('Invalid or expired verification code.');
        }

        // Mark the code as successfully verified.
        await client.query(
            `UPDATE email_verification_codes
             SET verified_at = NOW()
             WHERE verification_id = $1`,
            [verification.verification_id]
        );

        await client.query('COMMIT');

        return {
            message: 'Email successfully verified.',
            registryStudentId: studentId
        };

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK').catch(() => {});
        }

        throw error;

    } finally {
        client.release();
    }
};