const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// Get Inventory List
router.get('/', isAdmin, async (req, res) => {
    try {
        const [inventory] = await db.execute('SELECT * FROM gym_inventory ORDER BY next_maintenance_date ASC');
        res.render('admin/inventory/index', { inventory, page: 'inventory' });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Error loading inventory', status: 500 });
    }
});

// Add Item
router.post('/add', isAdmin, async (req, res) => {
    const { item_name, category, quantity, status, next_maintenance_date, notes } = req.body;
    try {
        await db.execute(
            'INSERT INTO gym_inventory (item_name, category, quantity, status, next_maintenance_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [item_name, category, quantity, status, next_maintenance_date || null, notes]
        );
        req.session.success = "Equipment added to inventory!";
        res.redirect('/inventory');
    } catch (err) {
        console.error(err);
        req.session.error = "Error adding equipment";
        res.redirect('/inventory');
    }
});

// Update Status
router.post('/update/:id', isAdmin, async (req, res) => {
    const { status, last_maintenance_date, next_maintenance_date, notes } = req.body;
    try {
        await db.execute(
            'UPDATE gym_inventory SET status = ?, last_maintenance_date = ?, next_maintenance_date = ?, notes = ? WHERE id = ?',
            [status, last_maintenance_date || null, next_maintenance_date || null, notes, req.params.id]
        );
        req.session.success = "Equipment status updated!";
        res.redirect('/inventory');
    } catch (err) {
        console.error(err);
        req.session.error = "Error updating equipment";
        res.redirect('/inventory');
    }
});

// Delete Item
router.get('/delete/:id', isAdmin, async (req, res) => {
    try {
        await db.execute('DELETE FROM gym_inventory WHERE id = ?', [req.params.id]);
        req.session.success = "Equipment removed from inventory";
        res.redirect('/inventory');
    } catch (err) {
        console.error(err);
        req.session.error = "Error removing equipment";
        res.redirect('/inventory');
    }
});

module.exports = router;
