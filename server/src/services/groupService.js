
import { AppError } from '../utils/AppError.js';
import pool from '../config/database.js';


// Create a new collaboration group.
export const createGroup = async (userId, groupData) => {
    const {
        groupName,
        description,
        maxMembers,
        intentionId,
        objectives,
        expectedDeliverables,
        memberResponsibilities,
        memberExpectations,
        requiredSkillIds = [],
        acceptsAllYears = true,
        allowedYears = []
    } = groupData;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Validate year eligibility selections.
        const uniqueYears = [...new Set(allowedYears)];

        if (
            !uniqueYears.every(
                year => Number.isInteger(year) && year >= 1 && year <= 4
            )
        ) {
            throw new AppError('Invalid academic year selection.', 400);
        }

        if (acceptsAllYears && uniqueYears.length > 0) {
            throw new AppError(
                'Do not select individual years when accepting all years.',
                400
            );
        }

        if (!acceptsAllYears && uniqueYears.length === 0) {
            throw new AppError(
                'Select at least one academic year.',
                400
            );
        }

        // Validate the collaboration intention.
        const intention = await client.query(
            `SELECT intention_id
             FROM collaboration_intentions
             WHERE intention_id = $1`,
            [intentionId]
        );

        if (intention.rows.length === 0) {
            throw new AppError('Invalid collaboration intention.', 400);
        }

        // Validate all required skills.
        const uniqueSkillIds = [...new Set(requiredSkillIds)];

        if (uniqueSkillIds.length > 0) {
            const skills = await client.query(
                `SELECT skill_id
                 FROM skills
                 WHERE skill_id = ANY($1::uuid[])`,
                [uniqueSkillIds]
            );

            if (skills.rows.length !== uniqueSkillIds.length) {
                throw new AppError('One or more selected skills are invalid.', 400);
            }
        }

        // Create the group.
        const groupResult = await client.query(
            `INSERT INTO student_groups (
                group_name,
                description,
                created_by,
                max_members,
                intention_id,
                objectives,
                expected_deliverables,
                member_responsibilities,
                member_expectations,
                accepts_all_years
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                groupName.trim(),
                description?.trim() || null,
                userId,
                maxMembers,
                intentionId,
                objectives.trim(),
                expectedDeliverables.trim(),
                memberResponsibilities.trim(),
                memberExpectations.trim(),
                acceptsAllYears
            ]
        );

        const group = groupResult.rows[0];

        // Save the group's permitted academic years.
        if (!acceptsAllYears) {
            const values = [];
            const parameters = [];

            uniqueYears.forEach((year, index) => {
                const offset = index * 2;

                values.push(`($${offset + 1}, $${offset + 2})`);
                parameters.push(group.group_id, year);
            });

            await client.query(
                `INSERT INTO group_allowed_years (
                    group_id,
                    year_of_study
                 )
                 VALUES ${values.join(', ')}`,
                parameters
            );
        }

        // Add required skills.
        if (uniqueSkillIds.length > 0) {
            const values = [];
            const parameters = [];

            uniqueSkillIds.forEach((skillId, index) => {
                const offset = index * 2;

                values.push(`($${offset + 1}, $${offset + 2})`);
                parameters.push(group.group_id, skillId);
            });

            await client.query(
                `INSERT INTO group_required_skills (
                    group_id,
                    skill_id
                 )
                 VALUES ${values.join(', ')}`,
                parameters
            );
        }

        // Migration 010 automatically creates the owner's membership.
        await client.query('COMMIT');

        return group;

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {
        client.release();
    }
};
// Submit a request to join an open group.
export const submitMembershipRequest = async (
    groupId,
    studentId,
    message
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const groupResult = await client.query(
            `SELECT group_id, group_status, created_by, accepts_all_years
             FROM student_groups
             WHERE group_id = $1
             FOR UPDATE`,
            [groupId]
        );

        if (groupResult.rows.length === 0) {
            throw new AppError('Group not found.', 404);
        }

        const group = groupResult.rows[0];

        if (group.group_status !== 'open') {
            throw new AppError('This group is not accepting requests.', 409);
        }

        if (group.created_by === studentId) {
            throw new AppError('You cannot request to join your own group.', 400);
        }

        // Check the applicant's academic year.
        if (!group.accepts_all_years) {
            const studentResult = await client.query(
                `SELECT year_of_study
                 FROM student_profiles
                 WHERE user_id = $1`,
                [studentId]
            );

            if (
                studentResult.rows.length === 0 ||
                studentResult.rows[0].year_of_study == null
            ) {
                throw new AppError(
                    'Your academic year must be available in your profile before requesting membership.',
                    400
                );
            }

            const studentYear = studentResult.rows[0].year_of_study;

            const allowedYearResult = await client.query(
                `SELECT 1
                 FROM group_allowed_years
                 WHERE group_id = $1
                   AND year_of_study = $2`,
                [groupId, studentYear]
            );

            if (allowedYearResult.rows.length === 0) {
                throw new AppError(
                    'This group is not accepting membership requests from students in your year of study.',
                    403
                );
            }
        }

        const membership = await client.query(
            `SELECT membership_id
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
               AND membership_status = 'active'`,
            [groupId, studentId]
        );

        if (membership.rows.length > 0) {
            throw new AppError('You are already a member of this group.', 409);
        }

        const result = await client.query(
            `INSERT INTO collaboration_requests (
                group_id, student_id, message
             )
             VALUES ($1, $2, $3)
             RETURNING *`,
            [groupId, studentId, message?.trim() || null]
        );

        await client.query('COMMIT');

        return result.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});

        if (error.code === '23505') {
            throw new AppError(
                'You already have a pending request for this group.',
                409
            );
        }

        throw error;

    } finally {
        client.release();
    }
};


// Retrieve pending requests for a group owner.
// Retrieve pending membership requests for a group owner.
export const getGroupMembershipRequests = async (
    groupId,
    ownerId
) => {
    const result = await pool.query(
        `SELECT
            cr.request_id,
            cr.group_id,
            cr.student_id,
            cr.message,
            cr.request_status,
            cr.created_at,
            u.full_name,
            c.name AS course_name,
            sp.year_of_study

         FROM collaboration_requests cr

         JOIN student_groups sg
            ON sg.group_id = cr.group_id

         JOIN group_members gm
            ON gm.group_id = sg.group_id
           AND gm.student_id = $2
           AND gm.membership_role = 'owner'
           AND gm.membership_status = 'active'

         JOIN users u
            ON u.user_id = cr.student_id

         LEFT JOIN student_profiles sp
            ON sp.user_id = cr.student_id

         LEFT JOIN registry_students rs
            ON rs.registry_student_id = sp.registry_student_id

         LEFT JOIN courses c
            ON c.course_id = rs.course_id

         WHERE cr.group_id = $1
           AND cr.request_status = 'pending'

         ORDER BY cr.created_at ASC`,

        [groupId, ownerId]
    );

    return result.rows;
};


// Accept or reject a membership request.
export const respondToMembershipRequest = async (
    requestId,
    ownerId,
    decision
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const requestResult = await client.query(
            `SELECT
                cr.request_id,
                cr.group_id,
                cr.student_id,
                cr.request_status
             FROM collaboration_requests cr
             JOIN group_members gm
                ON gm.group_id = cr.group_id
             WHERE cr.request_id = $1
               AND gm.student_id = $2
               AND gm.membership_role = 'owner'
               AND gm.membership_status = 'active'
             FOR UPDATE OF cr`,
            [requestId, ownerId]
        );

        if (requestResult.rows.length === 0) {
            throw new AppError(
                'Request not found or you are not the group owner.',
                404
            );
        }

        const request = requestResult.rows[0];

        // Lock the group to serialize membership decisions.
        const groupResult = await client.query(
            `SELECT group_id, group_status, accepts_all_years
             FROM student_groups
             WHERE group_id = $1
             FOR UPDATE`,
            [request.group_id]
        );

        const group = groupResult.rows[0];

        if (request.request_status !== 'pending') {
            throw new AppError('This request has already been handled.', 409);
        }

        if (decision === 'accepted') {
            if (group.group_status !== 'open') {
                throw new AppError(
                    'This group is no longer accepting members.',
                    409
                );
            }

            // Recheck the applicant's academic year.
            if (!group.accepts_all_years) {
                const studentResult = await client.query(
                    `SELECT year_of_study
                     FROM student_profiles
                     WHERE user_id = $1
                     FOR SHARE`,
                    [request.student_id]
                );

                if (
                    studentResult.rows.length === 0 ||
                    studentResult.rows[0].year_of_study == null
                ) {
                    throw new AppError(
                        "The applicant's academic year is unavailable.",
                        409
                    );
                }

                const studentYear = studentResult.rows[0].year_of_study;

                const allowedYearResult = await client.query(
                    `SELECT 1
                     FROM group_allowed_years
                     WHERE group_id = $1
                       AND year_of_study = $2`,
                    [request.group_id, studentYear]
                );

                if (allowedYearResult.rows.length === 0) {
                    throw new AppError(
                        'The applicant no longer meets this group’s year-of-study requirements.',
                        409
                    );
                }
            }

            await client.query(
                `INSERT INTO group_members (
                    group_id, student_id, membership_role, membership_status
                 )
                 VALUES ($1, $2, 'member', 'active')`,
                [request.group_id, request.student_id]
            );
        }

        const updatedRequest = await client.query(
            `UPDATE collaboration_requests
             SET request_status = $1,
                 updated_at = NOW()
             WHERE request_id = $2
             RETURNING *`,
            [decision, requestId]
        );

        await client.query('COMMIT');

        return updatedRequest.rows[0];

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});

        if (error.code === 'P0001') {
            throw new AppError(
                'The group has reached its membership limit.',
                409
            );
        }

        if (error.code === '23505') {
            throw new AppError(
                'The student is already an active member.',
                409
            );
        }

        throw error;

    } finally {
        client.release();
    }
};
// Discover open groups within the student's academic scope.
export const discoverGroups = async (
    studentId,
    scope = 'university',
    memberYears = []
) => {
    const validScopes = ['course', 'department', 'school', 'university'];

    if (!validScopes.includes(scope)) {
        throw new AppError('Invalid discovery scope.', 400);
    }

    if (!Array.isArray(memberYears)) {
        throw new AppError('Invalid academic year filter.', 400);
    }

    const uniqueMemberYears = [...new Set(memberYears)];

    if (
        !uniqueMemberYears.every(
            year => Number.isInteger(year) && year >= 1 && year <= 4
        )
    ) {
        throw new AppError('Invalid academic year filter.', 400);
    }

    const result = await pool.query(
        `SELECT
            sg.group_id,
            sg.group_name,
            sg.description,
            sg.max_members,
            sg.group_status,
            sg.objectives,
            sg.expected_deliverables,
            sg.member_responsibilities,
            sg.member_expectations,
            sg.intention_id,
            sg.accepts_all_years AS "acceptsAllYears",

            COALESCE(
                ARRAY_AGG(DISTINCT gay.year_of_study)
                    FILTER (WHERE gay.year_of_study IS NOT NULL),
                '{}'
            ) AS "allowedYears",

            COALESCE(
    ARRAY_AGG(DISTINCT member_profile.year_of_study)
    FILTER (
        WHERE gm.membership_status = 'active'
        AND member_profile.year_of_study IS NOT NULL
    ),
    '{}'
) AS "memberYears",

            ci.intention_name,
            u.full_name AS creator_name,
            c.name AS course_name,
            d.name AS department_name,
            f.name AS faculty_name,

            COUNT(DISTINCT gm.membership_id) FILTER (
                WHERE gm.membership_status = 'active'
            ) AS current_members,

            COALESCE(
                ARRAY_AGG(DISTINCT s.skill_name)
                    FILTER (WHERE s.skill_id IS NOT NULL),
                '{}'
            ) AS required_skills,

            EXISTS (
                SELECT 1
                FROM collaboration_requests cr
                WHERE cr.group_id = sg.group_id
                  AND cr.student_id = $1
                  AND cr.request_status = 'pending'
            ) AS has_pending_request

        FROM student_groups sg

        JOIN student_profiles creator
            ON creator.user_id = sg.created_by

        JOIN users u
            ON u.user_id = sg.created_by

        LEFT JOIN registry_students rs
            ON rs.registry_student_id = creator.registry_student_id

        LEFT JOIN courses c
            ON c.course_id = rs.course_id

        LEFT JOIN departments d
            ON d.department_id = c.department_id

        LEFT JOIN faculties f
            ON f.faculty_id = d.faculty_id

        LEFT JOIN collaboration_intentions ci
            ON ci.intention_id = sg.intention_id

        LEFT JOIN group_members gm
            ON gm.group_id = sg.group_id

        LEFT JOIN student_profiles member_profile
            ON member_profile.user_id = gm.student_id

        LEFT JOIN group_allowed_years gay
            ON gay.group_id = sg.group_id

        LEFT JOIN group_required_skills grs
            ON grs.group_id = sg.group_id

        LEFT JOIN skills s
            ON s.skill_id = grs.skill_id

        WHERE sg.group_status = 'open'
          AND sg.created_by <> $1

          AND NOT EXISTS (
              SELECT 1
              FROM group_members existing
              WHERE existing.group_id = sg.group_id
                AND existing.student_id = $1
                AND existing.membership_status = 'active'
          )

          AND (
              $2 = 'university'

              OR (
                  $2 = 'school'
                  AND f.faculty_id = (
                      SELECT d2.faculty_id
                      FROM student_profiles sp2
                      JOIN registry_students rs2
                          ON rs2.registry_student_id = sp2.registry_student_id
                      JOIN courses c2
                          ON c2.course_id = rs2.course_id
                      JOIN departments d2
                          ON d2.department_id = c2.department_id
                      WHERE sp2.user_id = $1
                  )
              )

              OR (
                  $2 = 'department'
                  AND d.department_id = (
                      SELECT c2.department_id
                      FROM student_profiles sp2
                      JOIN registry_students rs2
                          ON rs2.registry_student_id = sp2.registry_student_id
                      JOIN courses c2
                          ON c2.course_id = rs2.course_id
                      WHERE sp2.user_id = $1
                  )
              )

              OR (
                  $2 = 'course'
                  AND c.course_id = (
                      SELECT rs2.course_id
                      FROM student_profiles sp2
                      JOIN registry_students rs2
                          ON rs2.registry_student_id = sp2.registry_student_id
                      WHERE sp2.user_id = $1
                  )
              )
          )

          AND (
              cardinality($3::smallint[]) = 0
              OR EXISTS (
                  SELECT 1
                  FROM group_members filtered_member
                  JOIN student_profiles filtered_profile
                      ON filtered_profile.user_id = filtered_member.student_id
                  WHERE filtered_member.group_id = sg.group_id
                    AND filtered_member.membership_status = 'active'
                    AND filtered_profile.year_of_study =
                        ANY($3::smallint[])
              )
          )

        GROUP BY
            sg.group_id,
            ci.intention_name,
            u.full_name,
            c.name,
            d.name,
            f.name

        ORDER BY sg.created_at DESC`,
        [studentId, scope, uniqueMemberYears]
    );

    return result.rows;
};
// Retrieve details of a specific group.
export const getGroupDetails = async (groupId, studentId) => {
    const result = await pool.query(
        `SELECT
            sg.*,
            ci.intention_name,
            u.full_name AS creator_name,

            COALESCE(
                ARRAY_AGG(DISTINCT gay.year_of_study)
                    FILTER (WHERE gay.year_of_study IS NOT NULL),
                '{}'
            ) AS allowed_years,

            COALESCE(
                ARRAY_AGG(DISTINCT member_profile.year_of_study)
                    FILTER (WHERE member_profile.year_of_study IS NOT NULL),
                '{}'
            ) AS member_years,

            COUNT(DISTINCT gm.membership_id) FILTER (
                WHERE gm.membership_status = 'active'
            ) AS current_members,

            COALESCE(
                ARRAY_AGG(DISTINCT s.skill_name)
                    FILTER (WHERE s.skill_id IS NOT NULL),
                '{}'
            ) AS required_skills,

            EXISTS (
                SELECT 1
                FROM group_members mine
                WHERE mine.group_id = sg.group_id
                  AND mine.student_id = $2
                  AND mine.membership_status = 'active'
            ) AS is_member,

            EXISTS (
                SELECT 1
                FROM collaboration_requests cr
                WHERE cr.group_id = sg.group_id
                  AND cr.student_id = $2
                  AND cr.request_status = 'pending'
            ) AS has_pending_request

         FROM student_groups sg

         JOIN users u
            ON u.user_id = sg.created_by

         LEFT JOIN collaboration_intentions ci
            ON ci.intention_id = sg.intention_id

         LEFT JOIN group_members gm
            ON gm.group_id = sg.group_id

         LEFT JOIN student_profiles member_profile
            ON member_profile.user_id = gm.student_id

         LEFT JOIN group_allowed_years gay
            ON gay.group_id = sg.group_id

         LEFT JOIN group_required_skills grs
            ON grs.group_id = sg.group_id

         LEFT JOIN skills s
            ON s.skill_id = grs.skill_id

         WHERE sg.group_id = $1

         GROUP BY
            sg.group_id,
            ci.intention_name,
            u.full_name`,
        [groupId, studentId]
    );

    if (result.rows.length === 0) {
        throw new AppError('Group not found.', 404);
    }

    return result.rows[0];
};

// Allow an active non-owner member to leave a group.
export const leaveGroup = async (userId, groupId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the group to serialize membership changes.
        const groupResult = await client.query(
            `SELECT group_id, created_by
             FROM student_groups
             WHERE group_id = $1
             FOR UPDATE`,
            [groupId]
        );

        if (groupResult.rows.length === 0) {
            throw new AppError('Group not found.', 404);
        }

        const group = groupResult.rows[0];

        // The creator cannot leave without transferring ownership.
        if (String(group.created_by) === String(userId)) {
            throw new AppError(
                'The group owner cannot leave without transferring ownership.',
                403
            );
        }

        // Check the student's active membership.
        const membershipResult = await client.query(
            `SELECT membership_role, membership_status
             FROM group_members
             WHERE group_id = $1
               AND student_id = $2
             FOR UPDATE`,
            [groupId, userId]
        );

        if (
            membershipResult.rows.length === 0 ||
            membershipResult.rows[0].membership_status !== 'active'
        ) {
            throw new AppError(
                'You are not an active member of this group.',
                404
            );
        }

        if (membershipResult.rows[0].membership_role === 'owner') {
            throw new AppError(
                'The group owner cannot leave without transferring ownership.',
                403
            );
        }

        // Preserve membership history by marking the membership inactive.
        await client.query(
            `UPDATE group_members
             SET membership_status = 'inactive'
             WHERE group_id = $1
               AND student_id = $2`,
            [groupId, userId]
        );

        // The database trigger automatically refreshes group status.
        await client.query('COMMIT');

        return {
            groupId,
            membershipStatus: 'inactive',
            message: 'You have successfully left the group.'
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
};