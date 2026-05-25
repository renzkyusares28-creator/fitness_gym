const db = require('../config/db');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

exports.getAllMembers = async (req, res) => {
    try {
        const [members] = await db.execute(`
            SELECT m.*, u.username, u.email, p.name as plan_name 
            FROM members m 
            JOIN users u ON m.user_id = u.id 
            LEFT JOIN membership_plans p ON m.membership_plan_id = p.id
            ORDER BY m.id DESC
        `);
        res.render('admin/members/index', { members });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching members', status: 500 });
    }
};

exports.renderAddMember = async (req, res) => {
    try {
        const [plans] = await db.execute('SELECT * FROM membership_plans');
        res.render('admin/members/add', { plans });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading add member page', status: 500 });
    }
};

exports.addMember = async (req, res) => {
    const { username, email, password, full_name, age, gender, address, contact_number, membership_plan_id } = req.body;
    const profile_picture = req.file ? `/uploads/${req.file.filename}` : null;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.execute(
            "INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'Member'))",
            [username, email, hashedPassword]
        );
        const userId = userResult.insertId;

        // 2. Generate QR Code Data (Base64)
        const qrCodeData = `GYM-MEMBER-${userId}-${Date.now()}`;
        const qrCodeImageUrl = await qrcode.toDataURL(qrCodeData);

        // 3. Create Member
        const registrationDate = new Date().toISOString().split('T')[0];
        // Calculate expiry based on plan (placeholder: 30 days)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const formattedExpiryDate = expiryDate.toISOString().split('T')[0];

        await connection.execute(
            `INSERT INTO members (user_id, full_name, age, gender, address, contact_number, profile_picture, membership_plan_id, qr_code_data, registration_date, membership_expiry_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, full_name, age, gender, address, contact_number, profile_picture, membership_plan_id, qrCodeImageUrl, registrationDate, formattedExpiryDate]
        );

        await connection.commit();
        req.session.success = "Member registered successfully!";
        res.redirect('/members');

    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "Error registering member: " + err.message;
        res.redirect('/members/add');
    } finally {
        connection.release();
    }
};

exports.deleteMember = async (req, res) => {
    const { id } = req.params;
    try {
        const [member] = await db.execute('SELECT user_id FROM members WHERE id = ?', [id]);
        if (member.length > 0) {
            await db.execute('DELETE FROM users WHERE id = ?', [member[0].user_id]);
        }
        req.session.success = "Member deleted successfully!";
        res.redirect('/members');
    } catch (err) {
        console.error(err);
        req.session.error = "Error deleting member";
        res.redirect('/members');
    }
};
