import assert from 'node:assert/strict';
import test from 'node:test';
import {
    canViewPublicStudentProfile,
    serializePublicStudentProfile
} from '../src/utils/publicProfileSerializer.js';

test('only approved and discoverable profiles are publicly visible', () => {
    assert.equal(
        canViewPublicStudentProfile(
            { profile_review_status: 'approved' },
            true
        ),
        true
    );
    assert.equal(
        canViewPublicStudentProfile(
            {
                profile_review_status: 'approved',
                profile_moderation_status: 'visible'
            },
            true
        ),
        true
    );
    assert.equal(
        canViewPublicStudentProfile(
            { profile_review_status: 'submitted' },
            true
        ),
        false
    );
    assert.equal(
        canViewPublicStudentProfile(
            { profile_review_status: 'approved' },
            false
        ),
        false
    );
    assert.equal(
        canViewPublicStudentProfile(
            {
                profile_review_status: 'approved',
                profile_moderation_status: 'hidden'
            },
            true
        ),
        false
    );
});

test('public profile serialization excludes private and review fields', () => {
    const result = serializePublicStudentProfile({
        profile: {
            full_name: 'Lee Student',
            profile_picture_url: null,
            bio: 'Interested in collaborative learning.',
            institution_name: 'Kisii University',
            faculty_name: 'Science',
            department_name: 'Computing',
            course_name: 'Computer Science',
            year_of_study: 2,
            collaboration_status: 'available',
            availability_hours_per_week: 8,
            preferred_meeting_mode: 'remote',
            preferred_meeting_times: ['Evenings'],
            email: 'private@example.test',
            registration_number: 'PRIVATE',
            user_id: 'private-id',
            profile_review_status: 'approved'
        },
        skills: [],
        interests: [],
        intentions: [],
        portfolios: [{
            title: 'Collaboration app',
            evidence_url: 'https://example.test/work',
            repository_url: 'https://example.test/repo',
            evidence: [{ title: 'Private review note' }]
        }]
    });

    assert.equal(result.fullName, 'Lee Student');
    assert.equal(result.course, 'Computer Science');
    assert.equal(Object.hasOwn(result, 'email'), false);
    assert.equal(Object.hasOwn(result, 'registration_number'), false);
    assert.equal(Object.hasOwn(result, 'user_id'), false);
    assert.equal(Object.hasOwn(result, 'profile_review_status'), false);
    assert.equal(Object.hasOwn(result, 'commitmentLevel'), false);
    assert.deepEqual(result.portfolios, [{
        title: 'Collaboration app',
        description: undefined,
        evidenceType: undefined,
        evidenceUrl: 'https://example.test/work',
        repositoryUrl: 'https://example.test/repo',
        liveDemoUrl: undefined
    }]);
});
