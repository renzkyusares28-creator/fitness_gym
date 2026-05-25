const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAuthenticated, attendanceController.getAttendanceHistory);
router.get('/scan', isAdmin, attendanceController.renderScanner);
router.post('/record', isAdmin, attendanceController.recordAttendance);

module.exports = router;
