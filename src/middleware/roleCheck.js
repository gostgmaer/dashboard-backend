const roleMiddleware = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
            const hasPermission = allowedRoles.some(role => userRoles.includes(role));
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
                });
            }
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Role verification failed',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };
};

module.exports = roleMiddleware;
