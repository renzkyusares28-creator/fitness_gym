const db = require('../config/db');

exports.getReports = async (req, res) => {
    try {
        // 1. Monthly Income Data
        const [incomeData] = await db.query(`
            SELECT MONTHNAME(payment_date) as month, SUM(amount) as total 
            FROM payments 
            WHERE YEAR(payment_date) = YEAR(CURRENT_DATE())
            GROUP BY MONTH(payment_date), MONTHNAME(payment_date)
            ORDER BY MONTH(payment_date)
        `);

        // 2. Membership Plan Distribution
        const [planData] = await db.query(`
            SELECT p.name, COUNT(m.id) as count 
            FROM membership_plans p 
            LEFT JOIN members m ON p.id = m.membership_plan_id 
            GROUP BY p.id, p.name
        `);

        // 3. Attendance Stats (Last 7 Days)
        const [attendanceData] = await db.query(`
            SELECT DATE(check_in_time) as date, COUNT(*) as count 
            FROM attendances 
            WHERE check_in_time >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
            GROUP BY DATE(check_in_time)
            ORDER BY DATE(check_in_time)
        `);

        // 4. Trainer Performance Stats
        const [trainerStats] = await db.query(`
            SELECT 
                t.id, 
                t.full_name, 
                COUNT(DISTINCT ts.member_id) as total_clients,
                COUNT(ts.id) as sessions_completed,
                AVG(tr.rating) as avg_rating
            FROM trainers t
            LEFT JOIN trainer_schedules ts ON t.id = ts.trainer_id
            LEFT JOIN trainer_reviews tr ON t.id = tr.trainer_id
            GROUP BY t.id, t.full_name
        `);

        res.render('reports/index', { 
            incomeData, 
            planData, 
            attendanceData,
            trainerStats,
            page: 'reports'
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error generating reports', status: 500 });
    }
};
