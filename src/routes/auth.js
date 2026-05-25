const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const qrcode = require('qrcode');

// Signup Page
router.get('/signup', async (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    try {
        const [plans] = await db.execute('SELECT * FROM membership_plans');
        res.render('auth/signup', { plans });
    } catch (err) {
        console.error(err);
        res.render('auth/signup', { plans: [] });
    }
});

// Signup Logic
router.post('/signup', async (req, res) => {
    const { username, email, password, confirmPassword, full_name, age, gender, address, contact_number, membership_plan_id } = req.body;

    if (password !== confirmPassword) {
        req.session.error = "Passwords do not match";
        return res.redirect('/auth/signup');
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Check if user exists
        const [existing] = await connection.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing.length > 0) {
            req.session.error = "Username or Email already exists";
            await connection.rollback();
            return res.redirect('/auth/signup');
        }

        // 2. Create User (Pending Approval)
        const hashedPassword = await bcrypt.hash(password, 10);
        const [role] = await connection.execute("SELECT id FROM roles WHERE name = 'Member'");
        const roleId = role[0].id;

        const [userResult] = await connection.execute(
            'INSERT INTO users (username, email, password, role_id, is_approved) VALUES (?, ?, ?, ?, 0)',
            [username, email, hashedPassword, roleId]
        );
        const userId = userResult.insertId;

        // 3. Generate QR Code Data (Base64)
        const qrCodeData = `GYM-MEMBER-${userId}-${Date.now()}`;
        const qrCodeImageUrl = await qrcode.toDataURL(qrCodeData);

        // 4. Create Member Profile
        const registrationDate = new Date().toISOString().split('T')[0];
        
        // Expiry will be set upon approval/payment, initially set to current date
        await connection.execute(
            `INSERT INTO members (user_id, full_name, age, gender, address, contact_number, membership_plan_id, qr_code_data, registration_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Inactive')`,
            [userId, full_name, age, gender, address, contact_number, membership_plan_id, qrCodeImageUrl, registrationDate]
        );

        await connection.commit();
        req.session.success = "Registration submitted! Please wait for Admin approval before logging in.";
        res.redirect('/auth/login');

    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "An error occurred during signup: " + err.message;
        res.redirect('/auth/signup');
    } finally {
        connection.release();
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

        if (!user.is_approved) {
            req.session.error = "Your account is pending approval from the Admin. Please try again later.";
            return res.redirect('/auth/login');
        }

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
