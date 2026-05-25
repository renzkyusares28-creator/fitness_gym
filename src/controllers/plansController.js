const db = require('../config/db');

exports.getAllPlans = async (req, res) => {
    try {
        const [plans] = await db.execute('SELECT * FROM membership_plans ORDER BY price ASC');
        res.render('admin/plans/index', { plans });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching plans', status: 500 });
    }
};

exports.addPlan = async (req, res) => {
    const { name, duration_months, price, description } = req.body;
    try {
        await db.execute(
            'INSERT INTO membership_plans (name, duration_months, price, description) VALUES (?, ?, ?, ?)',
            [name, duration_months, price, description]
        );
        req.session.success = "Plan added successfully!";
        res.redirect('/plans');
    } catch (err) {
        console.error(err);
        req.session.error = "Error adding plan";
        res.redirect('/plans');
    }
};

exports.deletePlan = async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM membership_plans WHERE id = ?', [id]);
        req.session.success = "Plan deleted successfully!";
        res.redirect('/plans');
    } catch (err) {
        console.error(err);
        req.session.error = "Error deleting plan (It might be linked to members)";
        res.redirect('/plans');
    }
};
