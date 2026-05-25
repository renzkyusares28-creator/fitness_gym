const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAllTrainers = async (req, res) => {
    try {
        const [trainers] = await db.execute(`
            SELECT t.*, u.email 
            FROM trainers t 
            JOIN users u ON t.user_id = u.id
        `);
        res.render('admin/trainers/index', { trainers, page: 'trainers' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching trainers', status: 500 });
    }
};

exports.renderAddTrainer = (req, res) => {
    res.render('admin/trainers/add', { page: 'trainers' });
};

exports.addTrainer = async (req, res) => {
    const { username, email, password, full_name, specialization, contact_number } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create User with Trainer role
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.execute(
            "INSERT INTO users (username, email, password, role_id, is_approved) VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'Trainer'), 1)",
            [username, email, hashedPassword]
        );
        const userId = userResult.insertId;

        // 2. Create Trainer record
        await connection.execute(
            'INSERT INTO trainers (user_id, full_name, specialization, contact_number) VALUES (?, ?, ?, ?)',
            [userId, full_name, specialization, contact_number]
        );

        await connection.commit();
        req.session.success = "Trainer added successfully!";
        res.redirect('/trainers');

    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "Error adding trainer: " + err.message;
        res.redirect('/trainers/add');
    } finally {
        connection.release();
    }
};

exports.renderEditTrainer = async (req, res) => {
    const { id } = req.params;
    try {
        const [trainer] = await db.execute(`
            SELECT t.*, u.username, u.email 
            FROM trainers t 
            JOIN users u ON t.user_id = u.id 
            WHERE t.id = ?
        `, [id]);

        if (trainer.length === 0) {
            req.session.error = "Trainer not found";
            return res.redirect('/trainers');
        }

        res.render('admin/trainers/edit', { trainer: trainer[0] });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading edit page', status: 500 });
    }
};

exports.updateTrainer = async (req, res) => {
    const { id } = req.params;
    const { username, email, full_name, specialization, contact_number } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Get user_id first
        const [trainer] = await connection.execute('SELECT user_id FROM trainers WHERE id = ?', [id]);
        const userId = trainer[0].user_id;

        // 1. Update User
        await connection.execute(
            'UPDATE users SET username = ?, email = ? WHERE id = ?',
            [username, email, userId]
        );

        // 2. Update Trainer
        await connection.execute(
            'UPDATE trainers SET full_name = ?, specialization = ?, contact_number = ? WHERE id = ?',
            [full_name, specialization, contact_number, id]
        );

        await connection.commit();
        req.session.success = "Trainer updated successfully!";
        res.redirect('/trainers');

    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.session.error = "Error updating trainer: " + err.message;
        res.redirect(`/trainers/edit/${id}`);
    } finally {
        connection.release();
    }
};

exports.deleteTrainer = async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get user_id first
        const [trainer] = await connection.execute('SELECT user_id FROM trainers WHERE id = ?', [id]);
        if (trainer.length === 0) {
            await connection.rollback();
            req.session.error = "Trainer not found";
            return res.redirect('/trainers');
        }
        const userId = trainer[0].user_id;

        // 2. Delete dependent schedules
        await connection.execute('DELETE FROM trainer_schedules WHERE trainer_id = ?', [id]);

        // 3. Set assigned_by to NULL in workout programs (so we don't lose the programs)
        await connection.execute('UPDATE workout_programs SET assigned_by = NULL WHERE assigned_by = ?', [id]);

        // 4. Delete User (cascades to trainers table)
        await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

        await connection.commit();
        req.session.success = "Trainer and associated schedules deleted successfully!";
        res.redirect('/trainers');
    } catch (err) {
        await connection.rollback();
        console.error('Delete Trainer Error:', err.message);
        req.session.error = "Error deleting trainer: " + err.message;
        res.redirect('/trainers');
    } finally {
        connection.release();
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

        let trainers = [];
        let members = [];
        if (req.session.user.role === 'Admin' || req.session.user.role === 'Trainer') {
            const [trainerData] = await db.execute('SELECT id, full_name FROM trainers');
            const [memberData] = await db.execute("SELECT id, full_name FROM members WHERE status = 'Active'");
            trainers = trainerData;
            members = memberData;
        }

        res.render('trainers/schedules', { schedules, trainers, members, page: 'attendance' });
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
