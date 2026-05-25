module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session.user) {
            return next();
        }
        req.session.error = "Please login to access this page.";
        res.redirect('/auth/login');
    },
    isAdmin: (req, res, next) => {
        if (req.session.user && req.session.user.role === 'Admin') {
            return next();
        }
        req.session.error = "Unauthorized access.";
        res.redirect('/dashboard');
    },
    isTrainer: (req, res, next) => {
        if (req.session.user && (req.session.user.role === 'Trainer' || req.session.user.role === 'Admin')) {
            return next();
        }
        req.session.error = "Unauthorized access.";
        res.redirect('/dashboard');
    }
};
