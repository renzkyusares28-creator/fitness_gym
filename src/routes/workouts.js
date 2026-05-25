const express = require('express');
const router = express.Router();
const workoutsController = require('../controllers/workoutsController');
const { isAuthenticated, isTrainer } = require('../middleware/authMiddleware');

router.get('/', isAuthenticated, workoutsController.getWorkouts);
router.post('/add', isTrainer, workoutsController.addWorkout);

module.exports = router;
