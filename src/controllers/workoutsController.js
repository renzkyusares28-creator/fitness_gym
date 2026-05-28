const db = require('../config/db');

exports.getWorkouts = async (req, res) => {
    try {
        let query = `
            SELECT w.id, w.program_name, w.category, w.description, w.member_id, w.assigned_by, w.created_at,
                   m.full_name as member_name, t.full_name as trainer_name 
            FROM workout_programs w 
            JOIN members m ON w.member_id = m.id 
            LEFT JOIN trainers t ON w.assigned_by = t.id
        `;
        const params = [];

        if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        } else if (req.session.user.role === 'Trainer') {
            query += ' WHERE t.user_id = ?';
            params.push(req.session.user.id);
        }

        const [workouts] = await db.query(query, params);

        let members = [];
        let trainers = [];
        if (req.session.user.role === 'Admin') {
            const [memberData] = await db.query("SELECT id, full_name FROM members WHERE status = 'Active'");
            members = memberData;
            
            const [trainerData] = await db.query("SELECT id, full_name FROM trainers");
            trainers = trainerData;
        } else if (req.session.user.role === 'Trainer') {
            const [trainer] = await db.query('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            const trainerId = trainer[0]?.id;

            const [memberData] = await db.query(`
                SELECT DISTINCT m.id, m.full_name 
                FROM members m 
                JOIN trainer_schedules s ON m.id = s.member_id 
                WHERE s.trainer_id = ? AND m.status = 'Active'
            `, [trainerId]);
            members = memberData;
            
            const [trainerData] = await db.query("SELECT id, full_name FROM trainers");
            trainers = trainerData;
        }

        res.render('workouts/index', { workouts, members, trainers, page: 'workouts' });
    } catch (err) {
        console.error('Fetch Workouts Error:', err);
        res.status(500).render('error', { message: 'Error fetching workouts: ' + err.message, status: 500 });
    }
};

exports.addWorkout = async (req, res) => {
    const { member_id, program_name, category, description, assigned_by } = req.body;
    
    try {
        let trainerId = assigned_by || null;

        // If current user is a trainer and no trainer was selected in the form, use the current user's trainer id
        if (req.session.user.role === 'Trainer' && !trainerId) {
            const [trainer] = await db.query('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            trainerId = trainer[0]?.id;
        }

        await db.query(
            'INSERT INTO workout_programs (member_id, program_name, category, description, assigned_by) VALUES (?, ?, ?, ?, ?)',
            [member_id, program_name, category, description, trainerId]
        );
        req.session.success = "Workout program assigned successfully!";
        res.redirect(req.get('Referer') || '/workouts');
    } catch (err) {
        console.error('Add Workout Error:', err);
        req.session.error = "Error assigning workout program: " + err.message;
        res.redirect(req.get('Referer') || '/workouts');
    }
};

exports.updateWorkout = async (req, res) => {
    const { id } = req.params;
    const { member_id, program_name, category, description, assigned_by } = req.body;
    
    try {
        // Security check for Trainers
        if (req.session.user.role === 'Trainer') {
            const [trainer] = await db.query('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            const trainerId = trainer[0]?.id;
            
            const [workout] = await db.query('SELECT assigned_by FROM workout_programs WHERE id = ?', [id]);
            if (workout.length === 0 || workout[0].assigned_by !== trainerId) {
                req.session.error = "Unauthorized to update this workout program";
                return res.redirect(req.get('Referer') || '/workouts');
            }
        }

        await db.query(
            'UPDATE workout_programs SET member_id = ?, program_name = ?, category = ?, description = ?, assigned_by = ? WHERE id = ?',
            [member_id, program_name, category, description, assigned_by || null, id]
        );
        req.session.success = "Workout program updated successfully!";
        res.redirect(req.get('Referer') || '/workouts');
    } catch (err) {
        console.error('Update Workout Error:', err);
        req.session.error = "Error updating workout program: " + err.message;
        res.redirect(req.get('Referer') || '/workouts');
    }
};

exports.deleteWorkout = async (req, res) => {
    const { id } = req.params;
    try {
        // Security check for Trainers
        if (req.session.user.role === 'Trainer') {
            const [trainer] = await db.query('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            const trainerId = trainer[0]?.id;
            
            const [workout] = await db.query('SELECT assigned_by FROM workout_programs WHERE id = ?', [id]);
            if (workout.length === 0 || workout[0].assigned_by !== trainerId) {
                req.session.error = "Unauthorized to delete this workout program";
                return res.redirect(req.get('Referer') || '/workouts');
            }
        }

        await db.query('DELETE FROM workout_programs WHERE id = ?', [id]);
        req.session.success = "Workout program deleted successfully!";
        res.redirect(req.get('Referer') || '/workouts');
    } catch (err) {
        console.error('Delete Workout Error:', err);
        req.session.error = "Error deleting workout program: " + err.message;
        res.redirect(req.get('Referer') || '/workouts');
    }
};
