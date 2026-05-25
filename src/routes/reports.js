const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAdmin, reportsController.getReports);

module.exports = router;
