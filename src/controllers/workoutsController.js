const db = require('../config/db');

exports.getWorkouts = async (req, res) => {
    try {
        let query = `
            SELECT w.*, m.full_name as member_name, t.full_name as trainer_name 
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

        const [workouts] = await db.execute(query, params);

        let members = [];
        let trainers = [];
        if (req.session.user.role !== 'Member') {
            const [memberData] = await db.execute("SELECT id, full_name FROM members WHERE status = 'Active'");
            members = memberData;
            
            const [trainerData] = await db.execute("SELECT id, full_name FROM trainers");
            trainers = trainerData;
        }

        res.render('workouts/index', { workouts, members, trainers, page: 'workouts' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching workouts', status: 500 });
    }
};

exports.addWorkout = async (req, res) => {
    const { member_id, program_name, category, description, assigned_by } = req.body;
    
    try {
        let trainerId = assigned_by || null;

        // If current user is a trainer and no trainer was selected in the form, use the current user's trainer id
        if (req.session.user.role === 'Trainer' && !trainerId) {
            const [trainer] = await db.execute('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            trainerId = trainer[0]?.id;
        }

        await db.execute(
            'INSERT INTO workout_programs (member_id, program_name, category, description, assigned_by) VALUES (?, ?, ?, ?, ?)',
            [member_id, program_name, category, description, trainerId]
        );
        req.session.success = "Workout program assigned successfully!";
        res.redirect('/workouts');
    } catch (err) {
        console.error(err);
        req.session.error = "Error assigning workout program";
        res.redirect('/workouts');
    }
};
