export const canViewPublicStudentProfile = (profile, discoverable) =>
    discoverable === true &&
    profile?.profile_review_status === 'approved';

export const serializePublicStudentProfile = ({
    profile,
    skills,
    interests,
    intentions,
    portfolios
}) => ({
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
    portfolios: portfolios.map(portfolio => ({
        title: portfolio.title,
        description: portfolio.description,
        evidenceType: portfolio.evidence_type,
        evidenceUrl: portfolio.evidence_url,
        repositoryUrl: portfolio.repository_url,
        liveDemoUrl: portfolio.live_demo_url
    }))
});
