import pool from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const lockStudentProfile = async (client, userId) => {
  const result = await client.query(
    `SELECT profile_review_status
     FROM student_profiles
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );

  if (!result.rows.length) {
    throw new AppError('Student profile not found.', 404);
  }

  const status = result.rows[0].profile_review_status;

  if (status === 'submitted') {
    throw new AppError(
      'Your profile is currently under review.',
      409
    );
  }

  if (status === 'approved') {
    await client.query(
      `UPDATE student_profiles
       SET profile_review_status = 'draft',
           profile_submitted_at = NULL,
           profile_reviewed_at = NULL,
           profile_reviewed_by = NULL
       WHERE user_id = $1`,
      [userId]
    );
  }
};

export const getStudentAssessments = async (userId) => {
  const result = await pool.query(
    `SELECT
       sa.assessment_id,
       sa.skill_id,
       s.skill_name,
       s.category,
       sa.assessment_method,
       sa.assessment_status,
       sa.assessment_summary,
       sa.demonstrated_capabilities,
       sa.strengths,
       sa.improvement_areas,
       sa.assessed_at,
       sa.created_at
     FROM skill_assessments sa
     JOIN skills s ON s.skill_id = sa.skill_id
     WHERE sa.student_id = $1
     ORDER BY sa.created_at DESC`,
    [userId]
  );

  return result.rows;
};

export const getAssessmentEvidence = async (
  userId,
  assessmentId
) => {
  const result = await pool.query(
    `SELECT
       ae.evidence_id,
       ae.assessment_id,
       ae.portfolio_id,
       ae.evidence_type,
       ae.title,
       ae.description,
       ae.evidence_url,
       ae.created_at
     FROM assessment_evidence ae
     JOIN skill_assessments sa
       ON sa.assessment_id = ae.assessment_id
     WHERE sa.student_id = $1
       AND sa.assessment_id = $2
     ORDER BY ae.created_at DESC`,
    [userId, assessmentId]
  );

  return result.rows;
};

export const createAssessmentEvidence = async (
  userId,
  assessmentId,
  data
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await lockStudentProfile(client, userId);

    const assessment = await client.query(
  `SELECT assessment_id, assessment_method
   FROM skill_assessments
   WHERE assessment_id = $1
     AND student_id = $2
   FOR UPDATE`,
  [assessmentId, userId]
);

if (!assessment.rows.length) {
  throw new AppError('Assessment not found.', 404);
}

if (assessment.rows[0].assessment_method !== 'self_reported') {
  throw new AppError(
    'You cannot modify evidence associated with an independently assessed record.',
    403
  );
}

    if (!assessment.rows.length) {
      throw new AppError(
        'Assessment not found.',
        404
      );
    }

    if (data.portfolioId) {
      const portfolio = await client.query(
        `SELECT portfolio_id
         FROM portfolios
         WHERE portfolio_id = $1
           AND student_id = $2`,
        [data.portfolioId, userId]
      );

      if (!portfolio.rows.length) {
        throw new AppError(
          'Portfolio not found or does not belong to you.',
          404
        );
      }
    }

    const result = await client.query(
      `INSERT INTO assessment_evidence (
         assessment_id,
         portfolio_id,
         evidence_type,
         title,
         description,
         evidence_url
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        assessmentId,
        data.portfolioId ?? null,
        data.evidenceType,
        data.title,
        data.description ?? null,
        data.evidenceUrl ?? null
      ]
    );

    await client.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deleteAssessmentEvidence = async (
  userId,
  evidenceId
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await lockStudentProfile(client, userId);

    const result = await client.query(
      `DELETE FROM assessment_evidence ae
       USING skill_assessments sa
       WHERE ae.assessment_id = sa.assessment_id
         AND ae.evidence_id = $1
         AND sa.student_id = $2
         AND sa.assessment_method = 'self_reported'
       RETURNING ae.evidence_id`,
      [evidenceId, userId]
    );

    if (!result.rows.length) {
      throw new AppError(
        'Evidence not found.',
        404
      );
    }

    await client.query('COMMIT');

    return {
      message: 'Evidence deleted successfully.'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const createSelfReportedAssessment = async (
  userId,
  skillId
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await lockStudentProfile(client, userId);

    // Lock the student's skill record to prevent duplicate
    // assessment creation from concurrent requests.
    const skill = await client.query(
      `SELECT skill_id
       FROM student_skills
       WHERE student_id = $1
         AND skill_id = $2
       FOR UPDATE`,
      [userId, skillId]
    );

    if (!skill.rows.length) {
      throw new AppError(
        'Add this skill to your profile before creating an assessment.',
        400
      );
    }

    // Reuse an existing self-reported assessment.
    const existing = await client.query(
      `SELECT assessment_id,
              skill_id,
              assessment_method,
              assessment_status,
              assessment_summary,
              created_at
       FROM skill_assessments
       WHERE student_id = $1
         AND skill_id = $2
         AND assessment_method = 'self_reported'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId, skillId]
    );

    if (existing.rows.length) {
      await client.query('COMMIT');

      return {
        assessment: existing.rows[0],
        alreadyExists: true
      };
    }

    const result = await client.query(
      `INSERT INTO skill_assessments (
         student_id,
         skill_id,
         assessment_method,
         assessment_status,
         assessment_summary
       )
       VALUES (
         $1,
         $2,
         'self_reported',
         'pending',
         'Student-declared skill. Evidence has not been independently assessed.'
       )
       RETURNING *`,
      [userId, skillId]
    );

    await client.query('COMMIT');

    return {
      assessment: result.rows[0],
      alreadyExists: false
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};