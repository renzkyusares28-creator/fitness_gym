const db = require('../config/db');

exports.getAllTrainers = async (req, res) => {
    try {
        const [trainers] = await db.execute(`
            SELECT t.*, u.email 
            FROM trainers t 
            JOIN users u ON t.user_id = u.id
        `);
        res.render('admin/trainers/index', { trainers });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching trainers', status: 500 });
    }
};

exports.getSchedules = async (req, res) => {
    try {
        let query = `
            SELECT s.*, t.full_name as trainer_name, m.full_name as member_name 
            FROM trainer_schedules s 
            JOIN trainers t ON s.trainer_id = t.id 
            JOIN members m ON s.member_id = m.id
        `;
        const params = [];

        if (req.session.user.role === 'Trainer') {
            query += ' WHERE t.user_id = ?';
            params.push(req.session.user.id);
        } else if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        }

        query += ' ORDER BY s.schedule_date DESC, s.start_time DESC';

        const [schedules] = await db.execute(query, params);
        res.render('trainers/schedules', { schedules });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching schedules', status: 500 });
    }
};

exports.addSchedule = async (req, res) => {
    const { trainer_id, member_id, schedule_date, start_time, end_time, session_type } = req.body;
    try {
        await db.execute(
            'INSERT INTO trainer_schedules (trainer_id, member_id, schedule_date, start_time, end_time, session_type) VALUES (?, ?, ?, ?, ?, ?)',
            [trainer_id, member_id, schedule_date, start_time, end_time, session_type]
        );
        req.session.success = "Schedule added successfully!";
        res.redirect('/trainers/schedules');
    } catch (err) {
        console.error(err);
        req.session.error = "Error adding schedule";
        res.redirect('/trainers/schedules');
    }
};
