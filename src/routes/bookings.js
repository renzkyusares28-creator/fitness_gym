const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Get all bookings (Member sees theirs, Trainer sees theirs, Admin sees all)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        let query = `
            SELECT ts.*, t.full_name as trainer_name, m.full_name as member_name 
            FROM trainer_schedules ts 
            JOIN trainers t ON ts.trainer_id = t.id 
            JOIN members m ON ts.member_id = m.id
        `;
        const params = [];

        if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        } else if (req.session.user.role === 'Trainer') {
            query += ' WHERE t.user_id = ?';
            params.push(req.session.user.id);
        }

        query += ' ORDER BY ts.schedule_date DESC, ts.start_time DESC';

        const [bookings] = await db.execute(query, params);
        
        // For booking modal
        const [trainers] = await db.execute('SELECT id, full_name, specialization FROM trainers');
        
        res.render('bookings/index', { bookings, trainers, page: 'bookings' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading bookings', status: 500 });
    }
});

// Book a session
router.post('/add', isAuthenticated, async (req, res) => {
    const { trainer_id, schedule_date, start_time, session_type } = req.body;
    try {
        const [member] = await db.execute('SELECT id FROM members WHERE user_id = ?', [req.session.user.id]);
        const memberId = member[0]?.id;

        if (!memberId) {
            req.session.error = "Only members can book sessions.";
            return res.redirect('/bookings');
        }

        // Simple end time calculation (1 hour later)
        const startTimeParts = start_time.split(':');
        let hour = parseInt(startTimeParts[0]) + 1;
        const end_time = `${hour.toString().padStart(2, '0')}:${startTimeParts[1]}`;

        await db.execute(
            'INSERT INTO trainer_schedules (trainer_id, member_id, schedule_date, start_time, end_time, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [trainer_id, memberId, schedule_date, start_time, end_time, session_type, 'Pending']
        );

        req.session.success = "Session booked! Waiting for confirmation.";
        res.redirect('/bookings');
    } catch (err) {
        console.error(err);
        req.session.error = "Error booking session";
        res.redirect('/bookings');
    }
});

// Confirm/Cancel booking (Trainer or Admin)
router.post('/update-status/:id', isAuthenticated, async (req, res) => {
    const { status } = req.body;
    try {
        await db.execute('UPDATE trainer_schedules SET status = ? WHERE id = ?', [status, req.params.id]);
        req.session.success = `Booking ${status.toLowerCase()}!`;
        res.redirect('/bookings');
    } catch (err) {
        console.error(err);
        req.session.error = "Error updating booking status";
        res.redirect('/bookings');
    }
});

module.exports = router;
