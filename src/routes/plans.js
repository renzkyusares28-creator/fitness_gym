const express = require('express');
const router = express.Router();
const plansController = require('../controllers/plansController');
const { isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAdmin, plansController.getAllPlans);
router.post('/add', isAdmin, plansController.addPlan);
router.get('/delete/:id', isAdmin, plansController.deletePlan);

module.exports = router;
