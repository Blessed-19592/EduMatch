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