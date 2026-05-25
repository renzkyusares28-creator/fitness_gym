const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const { isAdmin } = require('../middleware/authMiddleware');

router.get('/', isAdmin, paymentsController.getAllPayments);
router.get('/add', isAdmin, paymentsController.renderAddPayment);
router.post('/add', isAdmin, paymentsController.addPayment);

module.exports = router;
