const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { 
    getNotifications, 
    getUnreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearAll 
} = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read/:id', protect, markAsRead);
router.put('/read-all', protect, markAllAsRead);
router.delete('/clear', protect, clearAll);

module.exports = router;