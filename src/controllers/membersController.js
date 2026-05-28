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
        res.render('admin/members/index', { members, page: 'members' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching members', status: 500 });
    }
};

exports.renderAddMember = async (req, res) => {
    try {
        const [plans] = await db.execute('SELECT * FROM membership_plans');
        res.render('admin/members/add', { plans, page: 'members' });
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
            "INSERT INTO users (username, email, password, role_id, is_approved) VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'Member'), 1)",
            [username, email, hashedPassword]
        );
        const userId = userResult.insertId;

        // 2. Generate QR Code Data (Base64)
        const qrCodeData = `GYM-MEMBER-${userId}-${Date.now()}`;
        const qrCodeImageUrl = await qrcode.toDataURL(qrCodeData);

        // 3. Create Member
        const registrationDate = new Date().toISOString().split('T')[0];
        
        // Fetch plan duration to calculate expiry
        const [plan] = await connection.execute('SELECT duration_months FROM membership_plans WHERE id = ?', [membership_plan_id]);
        const months = plan.length > 0 ? plan[0].duration_months : 1;

        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + months);
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
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get user_id first
        const [member] = await connection.execute('SELECT user_id FROM members WHERE id = ?', [id]);
        if (member.length === 0) {
            await connection.rollback();
            req.session.error = "Member not found";
            return res.redirect('/members');
        }
        const userId = member[0].user_id;

        // 2. Delete all dependent records
        await connection.execute('DELETE FROM attendances WHERE member_id = ?', [id]);
        await connection.execute('DELETE FROM payments WHERE member_id = ?', [id]);
        await connection.execute('DELETE FROM trainer_schedules WHERE member_id = ?', [id]);
        await connection.execute('DELETE FROM workout_programs WHERE member_id = ?', [id]);
        await connection.execute('DELETE FROM qr_codes WHERE member_id = ?', [id]);

        // 3. Delete User (cascades to members table)
        await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

        await connection.commit();
        req.session.success = "Member and all associated data deleted successfully!";
        res.redirect('/members');

    } catch (err) {
        await connection.rollback();
        console.error('Delete Member Error:', err.message);
        req.session.error = "Error deleting member: " + err.message;
        res.redirect('/members');
    } finally {
        connection.release();
    }
};

exports.renderEditMember = async (req, res) => {
    const { id } = req.params;
    try {
        const [member] = await db.execute(`
            SELECT m.*, u.username, u.email 
            FROM members m 
            JOIN users u ON m.user_id = u.id 
            WHERE m.id = ?
        `, [id]);

        if (member.length === 0) {
            req.session.error = "Member not found";
            return res.redirect('/members');
        }

        const [plans] = await db.execute('SELECT * FROM membership_plans');
        res.render('admin/members/edit', { member: member[0], plans });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading edit page', status: 500 });
    }
};

exports.updateMember = async (req, res) => {
    const { id } = req.params;
    const { username, email, full_name, age, gender, address, contact_number, membership_plan_id, status, emergency_contact, medical_conditions, allergies } = req.body;
    const profile_picture = req.file ? `/uploads/${req.file.filename}` : req.body.old_profile_picture;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Get user_id first
        const [member] = await connection.execute('SELECT user_id FROM members WHERE id = ?', [id]);
        const userId = member[0].user_id;

        // 1. Update User
        await connection.execute(
            'UPDATE users SET username = ?, email = ? WHERE id = ?',
            [username, email, userId]
        );

        // 2. Update Member
        await connection.execute(
            `UPDATE members SET full_name = ?, age = ?, gender = ?, address = ?, contact_number = ?, profile_picture = ?, membership_plan_id = ?, status = ?, emergency_contact = ?, medical_conditions = ?, allergies = ?
             WHERE id = ?`,
            [full_name, age, gender, address, contact_number, profile_picture, membership_plan_id, status, emergency_contact, medical_conditions, allergies, id]
        );

        await connection.commit();
        req.session.success = "Member updated successfully!";
        res.redirect('/members');

    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "Error updating member: " + err.message;
        res.redirect(`/members/edit/${id}`);
    } finally {
        connection.release();
    }
};

exports.getPendingMembers = async (req, res) => {
    try {
        const [pendingUsers] = await db.execute(`
            SELECT id, username, email, created_at 
            FROM users 
            WHERE is_approved = 0 
            ORDER BY created_at DESC
        `);
        res.render('admin/members/pending', { pendingUsers, page: 'members' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching pending members', status: 500 });
    }
};

exports.approveMember = async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Approve User
        await connection.execute('UPDATE users SET is_approved = 1 WHERE id = ?', [id]);

        // 2. Activate Member and set expiry date based on plan
        const [member] = await connection.execute('SELECT m.id, p.duration_months FROM members m LEFT JOIN membership_plans p ON m.membership_plan_id = p.id WHERE m.user_id = ?', [id]);
        
        if (member.length > 0) {
            const { id: memberId, duration_months } = member[0];
            const months = duration_months || 1; // Default to 1 month if plan not found or duration missing
            await connection.execute(
                "UPDATE members SET status = 'Active', membership_expiry_date = DATE_ADD(CURRENT_DATE(), INTERVAL ? MONTH) WHERE id = ?",
                [months, memberId]
            );
        }

        await connection.commit();
        req.session.success = "User approved and membership activated!";
        res.redirect('/members/pending');
    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "Error approving user: " + err.message;
        res.redirect('/members/pending');
    } finally {
        connection.release();
    }
};

exports.rejectMember = async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        req.session.success = "Registration rejected and user deleted.";
        res.redirect('/members/pending');
    } catch (err) {
        console.error(err);
        req.session.error = "Error rejecting user";
        res.redirect('/members/pending');
    }
};


