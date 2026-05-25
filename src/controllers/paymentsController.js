const db = require('../config/db');

exports.getAllPayments = async (req, res) => {
    try {
        const [payments] = await db.execute(`
            SELECT p.*, m.full_name, pl.name as plan_name 
            FROM payments p 
            JOIN members m ON p.member_id = m.id 
            JOIN membership_plans pl ON p.plan_id = pl.id
            ORDER BY p.payment_date DESC
        `);
        res.render('admin/payments/index', { payments, page: 'payments' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching payments', status: 500 });
    }
};

exports.renderAddPayment = async (req, res) => {
    try {
        const [members] = await db.execute('SELECT id, full_name FROM members');
        const [plans] = await db.execute('SELECT id, name, price FROM membership_plans');
        res.render('admin/payments/add', { members, plans, page: 'payments' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading payment page', status: 500 });
    }
};

exports.addPayment = async (req, res) => {
    const { member_id, plan_id, amount, payment_method } = req.body;
    const receipt_number = 'REC-' + Date.now();

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Record Payment
        await connection.execute(
            'INSERT INTO payments (member_id, plan_id, amount, payment_method, receipt_number) VALUES (?, ?, ?, ?, ?)',
            [member_id, plan_id, amount, payment_method, receipt_number]
        );

        // 2. Update Member Expiry Date
        const [plan] = await connection.execute('SELECT duration_months FROM membership_plans WHERE id = ?', [plan_id]);
        const duration = plan[0].duration_months;

        await connection.execute(
            "UPDATE members SET membership_plan_id = ?, status = 'Active', membership_expiry_date = DATE_ADD(CURRENT_DATE(), INTERVAL ? MONTH) WHERE id = ?",
            [plan_id, duration, member_id]
        );

        await connection.commit();
        req.session.success = "Payment recorded and membership updated!";
        res.redirect('/payments');

    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "Error recording payment";
        res.redirect('/payments/add');
    } finally {
        connection.release();
    }
};
