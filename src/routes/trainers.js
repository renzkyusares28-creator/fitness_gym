const express = require('express');
const router = express.Router();
const trainersController = require('../controllers/trainersController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAdmin, trainersController.getAllTrainers);
router.get('/add', isAdmin, trainersController.renderAddTrainer);
router.post('/add', isAdmin, trainersController.addTrainer);
router.get('/edit/:id', isAdmin, trainersController.renderEditTrainer);
router.post('/edit/:id', isAdmin, trainersController.updateTrainer);
router.get('/delete/:id', isAdmin, trainersController.deleteTrainer);
router.get('/schedules', isAuthenticated, trainersController.getSchedules);
router.post('/schedules/add', isAdmin, trainersController.addSchedule);

module.exports = router;
