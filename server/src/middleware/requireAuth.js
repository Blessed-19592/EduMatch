export const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            status: 'error',
            message: 'Please log in to access this resource.',
        });
    }

    next();
};