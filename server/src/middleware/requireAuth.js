import pool from '../config/database.js';

export const requireAuth = async (req, res, next) => {
    try {
        const userId = req.session?.user?.userId;

        if (!userId) {
            return res.status(401).json({
                status: 'error',
                message: 'Please log in to access this resource.',
            });
        }

        const result = await pool.query(
            `SELECT user_id, account_status
             FROM users
             WHERE user_id = $1`,
            [userId]
        );

        if (
            result.rows.length === 0 ||
            result.rows[0].account_status !== 'active'
        ) {
            return req.session.destroy(() => {
                res.clearCookie('edumatch_sid');

                return res.status(401).json({
                    status: 'error',
                    message: 'Your account is unavailable. Please log in again.',
                });
            });
        }

        next();

    } catch (error) {
        next(error);
    }
};