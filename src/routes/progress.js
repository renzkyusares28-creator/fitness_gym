const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isTrainer } = require('../middleware/authMiddleware');

// Get Progress Tracking
router.get('/', isAuthenticated, async (req, res) => {
    try {
        let query = `
            SELECT p.*, m.full_name as member_name 
            FROM member_progress p 
            JOIN members m ON p.member_id = m.id
        `;
        const params = [];

        if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        } else if (req.session.user.role === 'Trainer') {
            const [trainer] = await db.execute('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            const trainerId = trainer[0]?.id;
            query += ' WHERE m.id IN (SELECT DISTINCT member_id FROM trainer_schedules WHERE trainer_id = ?)';
            params.push(trainerId);
        }

        query += ' ORDER BY p.recorded_at DESC';

        const [progress] = await db.execute(query, params);
        
        // Data for charts (last 6 records)
        const chartData = [...progress].reverse().slice(-6);

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

        res.render('progress/index', { progress, chartData, members, page: 'progress' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading progress data', status: 500 });
    }
});

// Add Progress Entry
router.post('/add', isTrainer, async (req, res) => {
    const { member_id, weight, bmi, body_fat_percentage, chest_size, arm_size, calories_burned, recorded_at } = req.body;
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
            return res.redirect('/progress');
        }

        await db.execute(
            `INSERT INTO member_progress (member_id, weight, bmi, body_fat_percentage, chest_size, arm_size, calories_burned, recorded_at, recorded_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [member_id, weight, bmi, body_fat_percentage, chest_size, arm_size, calories_burned, recorded_at || new Date(), trainerId]
        );
        req.session.success = "Progress entry recorded!";
        res.redirect('/progress');
    } catch (err) {
        console.error(err);
        req.session.error = "Error recording progress";
        res.redirect('/progress');
    }
});

module.exports = router;
