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
            // Trainers can see progress of all active members
        }

        query += ' ORDER BY p.recorded_at DESC';

        const [progress] = await db.execute(query, params);
        
        // Data for charts (last 6 records)
        const chartData = [...progress].reverse().slice(-6);

        let members = [];
        if (req.session.user.role === 'Trainer') {
            const [memberData] = await db.execute("SELECT id, full_name FROM members WHERE status = 'Active'");
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
