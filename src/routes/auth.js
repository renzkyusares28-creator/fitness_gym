const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Signup Page
router.get('/signup', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('auth/signup');
});

// Signup Logic
router.post('/signup', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        req.session.error = "Passwords do not match";
        return res.redirect('/auth/signup');
    }

    try {
        // Check if user exists
        const [existing] = await db.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing.length > 0) {
            req.session.error = "Username or Email already exists";
            return res.redirect('/auth/signup');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Default role is Member
        const [role] = await db.execute("SELECT id FROM roles WHERE name = 'Member'");
        const roleId = role[0].id;

        await db.execute(
            'INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, roleId]
        );

        req.session.success = "Account created! You can now login.";
        res.redirect('/auth/login');

    } catch (err) {
        console.error(err);
        req.session.error = "An error occurred during signup";
        res.redirect('/auth/signup');
    }
});

// Login Page
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('auth/login');
});

// Login Logic
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.execute(
            'SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = ?',
            [username]
        );

        if (users.length === 0) {
            req.session.error = "User not found. If this is a new setup, please run 'node seed.js' to create the admin account.";
            return res.redirect('/auth/login');
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            req.session.error = "Invalid username or password";
            return res.redirect('/auth/login');
        }

        // Set session
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        req.session.success = `Welcome back, ${user.username}!`;
        res.redirect('/dashboard');

    } catch (err) {
        console.error('Login Error:', err.message);
        console.error('Stack Trace:', err.stack);
        req.session.error = "An error occurred during login. Please ensure your database is connected and seeded.";
        res.redirect('/auth/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
