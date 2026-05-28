const db = require('../config/db');

exports.getAttendanceHistory = async (req, res) => {
    try {
        let query = `
            SELECT a.id, a.member_id, a.check_in_time, a.check_out_time, a.status, 
                   m.full_name, m.profile_picture 
            FROM attendances a 
            JOIN members m ON a.member_id = m.id
        `;
        const params = [];

        if (req.session.user.role === 'Member') {
            query += ' WHERE m.user_id = ?';
            params.push(req.session.user.id);
        }

        query += ' ORDER BY a.check_in_time DESC';

        const [attendance] = await db.query(query, params);
        res.render('attendance/index', { attendance, page: 'attendance' });
    } catch (err) {
        console.error('Fetch Attendance Error:', err);
        res.status(500).render('error', { message: 'Error fetching attendance: ' + err.message, status: 500 });
    }
};

exports.renderScanner = (req, res) => {
    res.render('attendance/scanner', { page: 'attendance' });
};

exports.recordAttendance = async (req, res) => {
    try {
        const { qrData } = req.body;
        
        if (!qrData || typeof qrData !== 'string') {
            return res.status(400).json({ success: false, message: 'Invalid QR data received' });
        }

        // qrData format: GYM-MEMBER-userId-timestamp
        const parts = qrData.trim().split('-');
        if (parts.length < 3 || parts[0] !== 'GYM' || parts[1] !== 'MEMBER') {
            return res.status(400).json({ success: false, message: 'Invalid QR Code format' });
        }

        const userId = parseInt(parts[2]);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid User ID in QR Code' });
        }

        // Fetch member details
        const [members] = await db.query(
            'SELECT id, full_name, status, membership_expiry_date FROM members WHERE user_id = ?', 
            [userId]
        );
        
        if (members.length === 0) {
            return res.status(404).json({ success: false, message: 'Member profile not found' });
        }

        const memberData = members[0];

        // Check membership status
        if (memberData.status !== 'Active') {
            return res.status(403).json({ success: false, message: `Membership is ${memberData.status || 'Inactive'}. Please contact admin.` });
        }

        // Check expiry
        if (!memberData.membership_expiry_date) {
            return res.status(403).json({ success: false, message: 'Membership expiry date not set. Please contact admin.' });
        }

        const expiryDate = new Date(memberData.membership_expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        if (expiryDate < today) {
            return res.status(403).json({ success: false, message: `Membership expired on ${expiryDate.toLocaleDateString()}` });
        }

        // Check for active session (check-in without check-out)
        const [activeSessions] = await db.query(
            'SELECT id FROM attendances WHERE member_id = ? AND check_out_time IS NULL ORDER BY check_in_time DESC LIMIT 1',
            [memberData.id]
        );

        if (activeSessions.length > 0) {
            // Record Check-out
            await db.query(
                "UPDATE attendances SET check_out_time = NOW(), status = 'Completed' WHERE id = ?",
                [activeSessions[0].id]
            );
            return res.json({ 
                success: true, 
                message: `Goodbye, ${memberData.full_name}! Check-out recorded at ${new Date().toLocaleTimeString()}.` 
            });
        }

        // Record Check-in
        await db.query(
            "INSERT INTO attendances (member_id, status, check_in_time) VALUES (?, 'Active', NOW())", 
            [memberData.id]
        );

        res.json({ 
            success: true, 
            message: `Welcome, ${memberData.full_name}! Check-in recorded at ${new Date().toLocaleTimeString()}.` 
        });

    } catch (err) {
        console.error('QR Scan Error:', err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
};
