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

router.get('/', isAdmin, membersController.getAllMembers);
router.get('/add', isAdmin, membersController.renderAddMember);
router.post('/add', isAdmin, upload.single('profile_picture'), membersController.addMember);
router.get('/delete/:id', isAdmin, membersController.deleteMember);

module.exports = router;
