import pool from '../config/database.js';

// Restrict access to users with specified roles.
export const requireRole = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // Check whether the user is logged in.
            if (!req.session?.user?.userId) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Authentication required.'
                });
            }

            // Retrieve the current account status and role.
            const result = await pool.query(
                `SELECT user_id, full_name, email, role, account_status
                 FROM users
                 WHERE user_id = $1`,
                [req.session.user.userId]
            );

            if (
                result.rows.length === 0 ||
                result.rows[0].account_status !== 'active'
            ) {
                return req.session.destroy(() => {
                    res.clearCookie('edumatch_sid');

                    return res.status(401).json({
                        status: 'error',
                        message: 'Your account is unavailable. Please log in again.'
                    });
                });
            }

            const user = result.rows[0];

            // Check whether the user's current role is permitted.
            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You do not have permission to access this resource.'
                });
            }

            // Make current database user information available to routes.
            req.currentUser = {
                userId: user.user_id,
                fullName: user.full_name,
                email: user.email,
                role: user.role
            };

            next();

        } catch (error) {
            next(error);
        }
    };
};

// Student-only access.
export const requireStudent = requireRole('student');

// Admin-only access.
export const requireAdmin = requireRole('admin');