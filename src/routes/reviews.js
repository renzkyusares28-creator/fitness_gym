const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Get all reviews
router.get('/', isAuthenticated, async (req, res) => {
    try {
        let query = `
            SELECT tr.*, t.full_name as trainer_name, m.full_name as member_name 
            FROM trainer_reviews tr 
            JOIN trainers t ON tr.trainer_id = t.id 
            JOIN members m ON tr.member_id = m.id
        `;
        const params = [];

        if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        }

        query += ' ORDER BY tr.created_at DESC';

        const [reviews] = await db.execute(query, params);
        
        // For review modal (Trainers who have worked with this member)
        let trainers = [];
        if (req.session.user.role === 'Member') {
            const [member] = await db.execute('SELECT id FROM members WHERE user_id = ?', [req.session.user.id]);
            const memberId = member[0]?.id;
            
            const [trainerData] = await db.execute(`
                SELECT DISTINCT t.id, t.full_name 
                FROM trainers t 
                JOIN trainer_schedules ts ON t.id = ts.trainer_id 
                WHERE ts.member_id = ?
            `, [memberId]);
            trainers = trainerData;
        }

        res.render('reviews/index', { reviews, trainers, page: 'reviews' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading reviews', status: 500 });
    }
});

// Submit a review
router.post('/add', isAuthenticated, async (req, res) => {
    const { trainer_id, rating, review } = req.body;
    try {
        const [member] = await db.execute('SELECT id FROM members WHERE user_id = ?', [req.session.user.id]);
        const memberId = member[0]?.id;

        if (!memberId) {
            req.session.error = "Only members can submit reviews.";
            return res.redirect('/reviews');
        }

        await db.execute(
            'INSERT INTO trainer_reviews (trainer_id, member_id, rating, review) VALUES (?, ?, ?, ?)',
            [trainer_id, memberId, rating, review]
        );

        req.session.success = "Review submitted! Thank you for your feedback.";
        res.redirect('/reviews');
    } catch (err) {
        console.error(err);
        req.session.error = "Error submitting review";
        res.redirect('/reviews');
    }
});

module.exports = router;
