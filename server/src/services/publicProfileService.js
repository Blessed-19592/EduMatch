import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';

import { getStudentProfile } from './profileService.js';
import {
    getStudentSkills,
    getStudentInterests,
    getStudentIntentions
} from './skillInterestService.js';

export const getPublicStudentProfile = async (studentId) => {
    // Retrieve the existing profile internally.
    // Sensitive fields will never be included in the response.
    const profile = await getStudentProfile(studentId);

    if (!profile) {
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
                p.live_demo_url,
                p.created_at,

                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'title', ae.title,
                                'description', ae.description,
                                'evidenceType', ae.evidence_type,
                                'evidenceUrl', ae.evidence_url,
                                'createdAt', ae.created_at
                            )
                            ORDER BY ae.created_at DESC
                        )
                        FROM assessment_evidence ae
                        WHERE ae.portfolio_id = p.portfolio_id
                    ),
                    '[]'::jsonb
                ) AS evidence

             FROM portfolios p

             WHERE p.student_id = $1

             ORDER BY p.created_at DESC`,
            [studentId]
        )
    ]);

    // Explicitly whitelist information other students may see.
    return {
        fullName: profile.full_name,
        profilePictureUrl: profile.profile_picture_url,
        bio: profile.bio,

        institution: profile.institution_name,
        faculty: profile.faculty_name,
        department: profile.department_name,
        course: profile.course_name,
        yearOfStudy: profile.year_of_study,

        collaborationStatus: profile.collaboration_status,
        availabilityHoursPerWeek: profile.availability_hours_per_week,
        preferredMeetingMode: profile.preferred_meeting_mode,
        preferredMeetingTimes: profile.preferred_meeting_times,
        commitmentLevel: profile.commitment_level,

        skills: skills.map(skill => ({
            skillName: skill.skill_name,
            category: skill.category,
            proficiencyLevel: skill.proficiency_level
        })),

        interests: interests.map(interest => ({
            interestName: interest.interest_name,
            category: interest.interest_category
        })),

        collaborationIntentions: intentions.map(intention => ({
            intentionCode: intention.intention_code,
            intentionName: intention.intention_name,
            description: intention.description
        })),

        portfolios: portfoliosResult.rows
    };
};