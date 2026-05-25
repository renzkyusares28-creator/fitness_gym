const express = require('express');
const router = express.Router();
const trainersController = require('../controllers/trainersController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAdmin, trainersController.getAllTrainers);
router.get('/schedules', isAuthenticated, trainersController.getSchedules);
router.post('/schedules/add', isAdmin, trainersController.addSchedule);

module.exports = router;
