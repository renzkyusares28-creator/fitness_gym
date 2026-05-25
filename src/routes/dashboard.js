const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const db = require('../config/db');

router.get('/', isAuthenticated, async (req, res) => {
    try {
        const stats = {};
        
        if (req.session.user.role === 'Admin') {
            // Fetch Admin Stats
            const [memberCount] = await db.execute('SELECT COUNT(*) as count FROM members');
            const [activeMemberCount] = await db.execute("SELECT COUNT(*) as count FROM members WHERE status = 'Active'");
            const [trainerCount] = await db.execute('SELECT COUNT(*) as count FROM trainers');
            const [monthlyIncome] = await db.execute('SELECT SUM(amount) as total FROM payments WHERE MONTH(payment_date) = MONTH(CURRENT_DATE())');
            
            stats.totalMembers = memberCount[0].count;
            stats.activeMembers = activeMemberCount[0].count;
            stats.totalTrainers = trainerCount[0].count;
            stats.monthlyIncome = monthlyIncome[0].total || 0;
            
            res.render('admin/dashboard', { stats });
        } else if (req.session.user.role === 'Trainer') {
            // Fetch Trainer Stats
            const [trainer] = await db.execute('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            const trainerId = trainer[0]?.id;
            
            const [memberCount] = await db.execute('SELECT COUNT(DISTINCT member_id) as count FROM trainer_schedules WHERE trainer_id = ?', [trainerId]);
            const [todaySessions] = await db.execute('SELECT COUNT(*) as count FROM trainer_schedules WHERE trainer_id = ? AND schedule_date = CURRENT_DATE()', [trainerId]);
            
            stats.assignedMembers = memberCount[0].count;
            stats.todaySessions = todaySessions[0].count;
            
            res.render('trainer/dashboard', { stats });
        } else {
            // Fetch Member Stats
            const [member] = await db.execute('SELECT m.*, p.name as plan_name FROM members m LEFT JOIN membership_plans p ON m.membership_plan_id = p.id WHERE m.user_id = ?', [req.session.user.id]);
            const memberData = member[0];
            
            const [attendanceCount] = await db.execute('SELECT COUNT(*) as count FROM attendances WHERE member_id = ?', [memberData?.id]);
            
            stats.attendanceCount = attendanceCount[0].count;
            stats.membershipStatus = memberData?.status || 'N/A';
            stats.expiryDate = memberData?.membership_expiry_date || 'N/A';
            
            res.render('member/dashboard', { stats, memberData });
        }
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading dashboard', status: 500 });
    }
});

module.exports = router;
