const db = require('../config/db');

exports.getAttendanceHistory = async (req, res) => {
    try {
        let query = `
            SELECT a.*, m.full_name, m.profile_picture 
            FROM attendances a 
            JOIN members m ON a.member_id = m.id
        `;
        const params = [];

        if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        }

        query += ' ORDER BY a.check_in_time DESC';

        const [attendance] = await db.execute(query, params);
        res.render('attendance/index', { attendance, page: 'attendance' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error fetching attendance', status: 500 });
    }
};

exports.renderScanner = (req, res) => {
    res.render('attendance/scanner', { page: 'attendance' });
};

exports.recordAttendance = async (req, res) => {
    const { qrData } = req.body;
    // qrData format: GYM-MEMBER-userId-timestamp
    const parts = qrData.split('-');
    if (parts.length < 3 || parts[0] !== 'GYM' || parts[1] !== 'MEMBER') {
        return res.status(400).json({ success: false, message: 'Invalid QR Code' });
    }

    const userId = parts[2];

    try {
        const [member] = await db.execute('SELECT id, full_name, status, membership_expiry_date FROM members WHERE user_id = ?', [userId]);
        
        if (member.length === 0) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        const memberData = member[0];

        if (memberData.status !== 'Active') {
            return res.status(403).json({ success: false, message: 'Membership is Inactive' });
        }

        const expiryDate = new Date(memberData.membership_expiry_date);
        if (expiryDate < new Date()) {
            return res.status(403).json({ success: false, message: 'Membership has expired' });
        }

        // Check if already checked in today (optional, but good practice)
        const [todayAttendance] = await db.execute(
            'SELECT * FROM attendances WHERE member_id = ? AND DATE(check_in_time) = CURRENT_DATE()',
            [memberData.id]
        );

        if (todayAttendance.length > 0) {
            return res.status(400).json({ success: false, message: 'Attendance already recorded for today' });
        }

        await db.execute('INSERT INTO attendances (member_id) VALUES (?)', [memberData.id]);

        res.json({ success: true, message: `Welcome, ${memberData.full_name}! Attendance recorded.` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
