// const express = require('express');
// const router = express.Router();
// const { protect, adminOnly } = require('../../middlewares/authMiddleware');
// const { getPendingRiders, verifyRider, getDashboardStats } = require('../../controllers/admin/adminController');

// router.get('/pending-riders', protect, adminOnly, getPendingRiders);
// router.put('/verify-rider/:id', protect, adminOnly, verifyRider);
// router.get('/stats', protect, adminOnly, getDashboardStats);


// module.exports = router;



















const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../../middlewares/authMiddleware');
const { 
    getPendingRiders, 
    verifyRider, 
    getDashboardStats, 
    getAllUsers, 
    getAllRides,
    deleteUser,
    getDetailedAnalytics 
} = require('../../controllers/admin/adminController');

router.get('/stats', protect, adminOnly, getDashboardStats);
router.get('/pending-riders', protect, adminOnly, getPendingRiders);
router.get('/users', protect, adminOnly, getAllUsers);
router.delete('/user/:id', protect, adminOnly, deleteUser);
router.get('/rides', protect, adminOnly, getAllRides);
router.put('/verify-rider/:id', protect, adminOnly, verifyRider);
router.get('/analytics', protect, adminOnly, getDetailedAnalytics);

module.exports = router;