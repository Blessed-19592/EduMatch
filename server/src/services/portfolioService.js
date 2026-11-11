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

  if (result.rows.length === 0) {
    throw new AppError('Student profile not found.', 404);
  }

  const status = result.rows[0].profile_review_status;

  if (status === 'submitted') {
    throw new AppError(
      'Your profile is currently under review. Changes are unavailable.',
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

export const getStudentPortfolios = async (userId) => {
  const result = await pool.query(
    `SELECT
       portfolio_id,
       title,
       description,
       evidence_type,
       evidence_url,
       repository_url,
       live_demo_url,
       created_at,
       updated_at
     FROM portfolios
     WHERE student_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
};

export const createPortfolio = async (userId, data) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await lockStudentProfile(client, userId);

    const result = await client.query(
      `INSERT INTO portfolios (
         student_id,
         title,
         description,
         evidence_type,
         evidence_url,
         repository_url,
         live_demo_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        data.title,
        data.description ?? null,
        data.evidenceType,
        data.evidenceUrl,
        data.repositoryUrl ?? null,
        data.liveDemoUrl ?? null
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

export const updatePortfolio = async (
  userId,
  portfolioId,
  data
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await lockStudentProfile(client, userId);

    const existing = await client.query(
      `SELECT portfolio_id
       FROM portfolios
       WHERE portfolio_id = $1
         AND student_id = $2
       FOR UPDATE`,
      [portfolioId, userId]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Portfolio not found.', 404);
    }

    const result = await client.query(
      `UPDATE portfolios
       SET title = $1,
           description = $2,
           evidence_type = $3,
           evidence_url = $4,
           repository_url = $5,
           live_demo_url = $6
       WHERE portfolio_id = $7
         AND student_id = $8
       RETURNING *`,
      [
        data.title,
        data.description ?? null,
        data.evidenceType,
        data.evidenceUrl,
        data.repositoryUrl ?? null,
        data.liveDemoUrl ?? null,
        portfolioId,
        userId
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

export const deletePortfolio = async (userId, portfolioId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await lockStudentProfile(client, userId);

    const result = await client.query(
      `DELETE FROM portfolios
       WHERE portfolio_id = $1
         AND student_id = $2
       RETURNING portfolio_id`,
      [portfolioId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Portfolio not found.', 404);
    }

    await client.query('COMMIT');

    return { message: 'Portfolio deleted successfully.' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};