const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');
const upload = require('../middlewares/fileUpload');

// Register (Uses 'upload.single' for profile picture)
// 'profilePic' must match the key name sent from Postman/Flutter
router.post('/register', upload.single('profilePic'), registerUser);

// Login
router.post('/login', loginUser);

module.exports = router;