const express = require('express');
const router = express.Router();
const { registerUser, loginUser,  forgotPassword, 
  resetPassword, 
  googleLogin, getCurrentUser, updateProfile, updateFcmToken} = require('../controllers/authController');
const upload = require('../middlewares/fileUpload');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register', upload.single('profilePic'), registerUser);

// Login
router.post('/login', loginUser);

router.get('/me', protect, getCurrentUser);


router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.post('/google-login', googleLogin);

router.put('/update-fcm', protect, updateFcmToken);

router.put('/update', protect, upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'licenseImage', maxCount: 1 },
    { name: 'selfieWithLicense', maxCount: 1 },
    { name: 'vehiclePhoto', maxCount: 1 },
    { name: 'billbookPage2', maxCount: 1 },
    { name: 'billbookPage3', maxCount: 1 },
    { name: 'citizenshipFront', maxCount: 1 },
    { name: 'citizenshipBack', maxCount: 1 }
]), updateProfile);

module.exports = router;