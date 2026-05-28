const express = require('express');
const router = express.Router();
const workoutsController = require('../controllers/workoutsController');
const { isAuthenticated, isTrainer } = require('../middleware/authMiddleware');

router.get('/', isAuthenticated, workoutsController.getWorkouts);
router.post('/add', isTrainer, workoutsController.addWorkout);
router.get('/edit/:id', isTrainer, (req, res) => res.redirect('/workouts'));
router.post('/edit/:id', isTrainer, workoutsController.updateWorkout);
router.post('/delete/:id', isTrainer, workoutsController.deleteWorkout);
router.get('/delete/:id', isTrainer, workoutsController.deleteWorkout);

module.exports = router;
