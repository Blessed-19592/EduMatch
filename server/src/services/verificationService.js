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