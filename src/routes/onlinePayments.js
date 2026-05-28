const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Get payment page (Member view)
router.get('/online', isAuthenticated, async (req, res) => {
    try {
        const [plans] = await db.execute('SELECT * FROM membership_plans');
        res.render('payments/online', { plans, page: 'payments' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading payment page', status: 500 });
    }
});

// Process online payment (Simulated)
router.post('/process', isAuthenticated, async (req, res) => {
    const { plan_id, payment_method } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [member] = await connection.execute('SELECT id FROM members WHERE user_id = ?', [req.session.user.id]);
        const memberId = member[0]?.id;

        if (!memberId) throw new Error("Member not found");

        const [plan] = await connection.execute('SELECT price, duration_months FROM membership_plans WHERE id = ?', [plan_id]);
        const { price, duration_months } = plan[0];

        // 1. Record Payment
        const receiptNumber = `PAY-${Date.now()}-${memberId}`;
        await connection.execute(
            'INSERT INTO payments (member_id, plan_id, amount, payment_method, status, receipt_number) VALUES (?, ?, ?, ?, ?, ?)',
            [memberId, plan_id, price, payment_method, 'Paid', receiptNumber]
        );

        // 2. Renew Membership
        await connection.execute(
            "UPDATE members SET status = 'Active', membership_plan_id = ?, membership_expiry_date = DATE_ADD(CURRENT_DATE(), INTERVAL ? MONTH) WHERE id = ?",
            [plan_id, duration_months, memberId]
        );

        await connection.commit();
        req.session.success = `Payment of ₱${price} successful via ${payment_method}! Membership renewed.`;
        res.redirect('/dashboard');

    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "Payment failed: " + err.message;
        res.redirect('/payments/online');
    } finally {
        connection.release();
    }
});

module.exports = router;
