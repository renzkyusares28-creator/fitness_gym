const express = require('express');
const router = express.Router();
const membersController = require('../controllers/membersController');
const { isAdmin } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

console.log('Loading Members Routes...');

// Admin Member Management
router.get('/pending', isAdmin, membersController.getPendingMembers);
router.get('/approve/:id', isAdmin, membersController.approveMember);
router.get('/delete-user/:id', isAdmin, membersController.rejectMember);
router.get('/edit/:id', isAdmin, membersController.renderEditMember);
router.post('/edit/:id', isAdmin, upload.single('profile_picture'), membersController.updateMember);
router.get('/add', isAdmin, membersController.renderAddMember);
router.post('/add', isAdmin, upload.single('profile_picture'), membersController.addMember);
router.get('/delete/:id', isAdmin, membersController.deleteMember);
router.get('/', isAdmin, membersController.getAllMembers);

module.exports = router;
