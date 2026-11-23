import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';


import { getStudentProfile } from './profileService.js';
import {
    getStudentSkills,
    getStudentInterests,
    getStudentIntentions
} from './skillInterestService.js';
import {
    canViewPublicStudentProfile,
    serializePublicStudentProfile
} from '../utils/publicProfileSerializer.js';

export const getPublicStudentProfile = async (studentId) => {
    const visibilityResult = await pool.query(
        `SELECT COALESCE((
            SELECT profile_discoverable
            FROM user_settings
            WHERE user_id = $1
        ), TRUE) AS profile_discoverable`,
        [studentId]
    );

    // Retrieve the existing profile internally.
    // Sensitive fields will never be included in the response.
    const profile = await getStudentProfile(studentId);

    if (!canViewPublicStudentProfile(
        profile,
        visibilityResult.rows[0]?.profile_discoverable
    )) {
        throw new AppError('Student profile not found.', 404);
    }

    // Retrieve the student's skills, interests and intentions.
    const [
        skills,
        interests,
        intentions,
        portfoliosResult
    ] = await Promise.all([
        getStudentSkills(studentId),
        getStudentInterests(studentId),
        getStudentIntentions(studentId),

        pool.query(
            `SELECT
                p.title,
                p.description,
                p.evidence_type,
                p.evidence_url,
                p.repository_url,
                p.live_demo_url

             FROM portfolios p

             WHERE p.student_id = $1

             ORDER BY p.created_at DESC`,
            [studentId]
        )
    ]);

    return serializePublicStudentProfile({
        profile,
        skills,
        interests,
        intentions,
        portfolios: portfoliosResult.rows
    });
};