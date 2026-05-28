const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isTrainer } = require('../middleware/authMiddleware');

// Get Nutrition Plans (Trainer can see all, Member sees only theirs)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        let query = `
            SELECT n.*, m.full_name as member_name, t.full_name as trainer_name 
            FROM nutrition_plans n 
            JOIN members m ON n.member_id = m.id 
            JOIN trainers t ON n.trainer_id = t.id
        `;
        const params = [];

        if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        } else if (req.session.user.role === 'Trainer') {
            query += ' WHERE t.user_id = ?';
            params.push(req.session.user.id);
        }

        const [plans] = await db.execute(query, params);
        
        // For trainer modal
        let members = [];
        if (req.session.user.role === 'Trainer') {
            const [trainer] = await db.execute('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            const trainerId = trainer[0]?.id;

            const [memberData] = await db.execute(`
                SELECT DISTINCT m.id, m.full_name 
                FROM members m 
                JOIN trainer_schedules s ON m.id = s.member_id 
                WHERE s.trainer_id = ? AND m.status = 'Active'
            `, [trainerId]);
            members = memberData;
        }

        res.render('nutrition/index', { plans, members, page: 'nutrition' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading nutrition plans', status: 500 });
    }
});

// Assign Nutrition Plan
router.post('/add', isTrainer, async (req, res) => {
    const { member_id, breakfast_plan, lunch_plan, dinner_plan, daily_calories_target, protein_target_grams, water_target_liters } = req.body;
    try {
        const [trainer] = await db.execute('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
        const trainerId = trainer[0]?.id;

        // Security check: Ensure member is assigned to this trainer
        const [isAssigned] = await db.execute(
            'SELECT 1 FROM trainer_schedules WHERE trainer_id = ? AND member_id = ? LIMIT 1',
            [trainerId, member_id]
        );

        if (isAssigned.length === 0) {
            req.session.error = "Unauthorized: This member is not assigned to you.";
            return res.redirect('/nutrition');
        }

        await db.execute(
            `INSERT INTO nutrition_plans (member_id, trainer_id, breakfast_plan, lunch_plan, dinner_plan, daily_calories_target, protein_target_grams, water_target_liters) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [member_id, trainerId, breakfast_plan, lunch_plan, dinner_plan, daily_calories_target, protein_target_grams, water_target_liters]
        );
        req.session.success = "Nutrition plan assigned successfully!";
        res.redirect('/nutrition');
    } catch (err) {
        console.error(err);
        req.session.error = "Error assigning nutrition plan";
        res.redirect('/nutrition');
    }
});

module.exports = router;
