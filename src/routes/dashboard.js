const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const db = require('../config/db');

router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Auto-deactivate expired members
        await db.execute("UPDATE members SET status = 'Inactive' WHERE membership_expiry_date < CURRENT_DATE() AND status = 'Active'");

        const stats = {};
        
        if (req.session.user.role === 'Admin') {
            // Fetch Admin Stats
            const [memberCount] = await db.execute('SELECT COUNT(*) as count FROM members');
            const [activeMemberCount] = await db.execute("SELECT COUNT(*) as count FROM members WHERE status = 'Active'");
            const [trainerCount] = await db.execute('SELECT COUNT(*) as count FROM trainers');
            const [monthlyIncome] = await db.execute('SELECT SUM(amount) as total FROM payments WHERE MONTH(payment_date) = MONTH(CURRENT_DATE())');
            const [pendingCount] = await db.execute('SELECT COUNT(*) as count FROM users WHERE is_approved = 0');
            
            stats.totalMembers = memberCount[0].count;
            stats.activeMembers = activeMemberCount[0].count;
            stats.totalTrainers = trainerCount[0].count;
            stats.monthlyIncome = monthlyIncome[0].total || 0;
            stats.pendingCount = pendingCount[0].count;

            // Fetch current capacity (members checked in but not checked out)
            const [currentCapacity] = await db.execute('SELECT COUNT(*) as count FROM attendances WHERE check_out_time IS NULL');
            stats.currentCapacity = currentCapacity[0].count;

            // Fetch memberships expiring this week
            const [expiringSoon] = await db.execute(`
                SELECT COUNT(*) as count FROM members 
                WHERE membership_expiry_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
                AND status = 'Active'
            `);
            stats.expiringThisWeek = expiringSoon[0].count;

            // Fetch Recent Members
            const [recentMembers] = await db.execute(`
                SELECT m.*, p.name as plan_name 
                FROM members m 
                LEFT JOIN membership_plans p ON m.membership_plan_id = p.id 
                ORDER BY m.registration_date DESC LIMIT 5
            `);

            // Fetch Recent Trainers
            const [recentTrainers] = await db.execute(`
                SELECT * FROM trainers ORDER BY id DESC LIMIT 5
            `);

            // Fetch Registration Stats for Chart (Last 6 Months)
            const [chartData] = await db.execute(`
                SELECT MONTHNAME(registration_date) as month, COUNT(*) as count 
                FROM members 
                WHERE registration_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
                GROUP BY MONTH(registration_date), MONTHNAME(registration_date)
                ORDER BY MONTH(registration_date)
            `);

            // Fetch Recent Workouts
            const [recentWorkouts] = await db.execute(`
                SELECT w.*, m.full_name as member_name, t.full_name as trainer_name 
                FROM workout_programs w 
                JOIN members m ON w.member_id = m.id 
                LEFT JOIN trainers t ON w.assigned_by = t.id 
                ORDER BY w.created_at DESC LIMIT 5
            `);

            // Fetch All Active Members for Assign Workout Modal
            const [members] = await db.execute("SELECT id, full_name FROM members WHERE status = 'Active'");
            
            // Fetch All Trainers for Assign Workout Modal
            const [trainers] = await db.execute("SELECT id, full_name FROM trainers");
            
            res.render('admin/dashboard', { stats, recentMembers, recentTrainers, chartData, recentWorkouts, members, trainers, page: 'dashboard' });
        } else if (req.session.user.role === 'Trainer') {
            // Fetch Trainer Stats
            const [trainer] = await db.execute('SELECT id FROM trainers WHERE user_id = ?', [req.session.user.id]);
            const trainerId = trainer[0]?.id;
            
            const [memberCount] = await db.execute('SELECT COUNT(DISTINCT member_id) as count FROM trainer_schedules WHERE trainer_id = ?', [trainerId]);
            const [todaySessionsCount] = await db.execute('SELECT COUNT(*) as count FROM trainer_schedules WHERE trainer_id = ? AND schedule_date = CURRENT_DATE()', [trainerId]);
            const [todaySessions] = await db.execute(`
                SELECT s.*, m.full_name as member_name 
                FROM trainer_schedules s 
                JOIN members m ON s.member_id = m.id 
                WHERE s.trainer_id = ? AND s.schedule_date = CURRENT_DATE()
                ORDER BY s.start_time ASC
            `, [trainerId]);

            const [assignedMembers] = await db.execute(`
                SELECT DISTINCT m.*, p.name as plan_name 
                FROM members m 
                JOIN trainer_schedules s ON m.id = s.member_id 
                LEFT JOIN membership_plans p ON m.membership_plan_id = p.id
                WHERE s.trainer_id = ?
            `, [trainerId]);

            // Fetch Upcoming Sessions (1 day in advance)
            const [upcomingSessions] = await db.execute(`
                SELECT s.*, m.full_name as member_name 
                FROM trainer_schedules s 
                JOIN members m ON s.member_id = m.id 
                WHERE s.trainer_id = ? AND s.schedule_date = DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY)
                ORDER BY s.start_time ASC
            `, [trainerId]);

            // Fetch Recently Assigned Workouts by this Trainer
            const [recentWorkouts] = await db.execute(`
                SELECT w.*, m.full_name as member_name 
                FROM workout_programs w 
                JOIN members m ON w.member_id = m.id 
                WHERE w.assigned_by = ? 
                ORDER BY w.created_at DESC LIMIT 5
            `, [trainerId]);
            
            stats.assignedMembersCount = memberCount[0].count;
            stats.todaySessionsCount = todaySessionsCount[0].count;
            
            res.render('trainer/dashboard', { stats, todaySessions, upcomingSessions, assignedMembers, recentWorkouts, page: 'dashboard' });
        } else {
            // Fetch Member Stats
            const [member] = await db.execute('SELECT m.*, p.name as plan_name FROM members m LEFT JOIN membership_plans p ON m.membership_plan_id = p.id WHERE m.user_id = ?', [req.session.user.id]);
            const memberData = member[0];
            
            const [attendanceCount] = await db.execute('SELECT COUNT(*) as count FROM attendances WHERE member_id = ?', [memberData?.id]);
            
            // Fetch current capacity for all members to see
            const [currentCapacity] = await db.execute('SELECT COUNT(*) as count FROM attendances WHERE check_out_time IS NULL');
            stats.currentCapacity = currentCapacity[0].count;

            // Fetch Recent Attendance
            const [recentAttendance] = await db.execute('SELECT check_in_time, check_out_time, status FROM attendances WHERE member_id = ? ORDER BY check_in_time DESC LIMIT 5', [memberData?.id]);

            // Fetch Assigned Workouts
            const [workouts] = await db.execute('SELECT * FROM workout_programs WHERE member_id = ? ORDER BY created_at DESC LIMIT 3', [memberData?.id]);

            // Fetch Upcoming Schedules
            const [schedules] = await db.execute(`
                SELECT s.*, t.full_name as trainer_name 
                FROM trainer_schedules s 
                JOIN trainers t ON s.trainer_id = t.id 
                WHERE s.member_id = ? AND s.schedule_date >= CURRENT_DATE()
                ORDER BY s.schedule_date ASC, s.start_time ASC 
                LIMIT 3
            `, [memberData?.id]);
            
            stats.attendanceCount = attendanceCount[0].count;
            stats.membershipStatus = memberData?.status || 'N/A';
            stats.expiryDate = memberData?.membership_expiry_date || 'N/A';

            // Check if expiring in 3 days
            if (memberData?.membership_expiry_date) {
                const expiry = new Date(memberData.membership_expiry_date);
                const today = new Date();
                const diffTime = expiry - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays >= 0 && diffDays <= 3) {
                    stats.expiryAlert = `Your membership expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}!`;
                } else if (diffDays < 0) {
                    stats.expiryAlert = `Your membership has expired. Please renew to continue using the gym.`;
                }
            }
            
            res.render('member/dashboard', { stats, memberData, recentAttendance, workouts, schedules, page: 'dashboard' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading dashboard', status: 500 });
    }
});

module.exports = router;
