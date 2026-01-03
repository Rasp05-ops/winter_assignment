const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);

// Mark as read
router.patch('/:notificationId/read', notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);

// Delete
router.delete('/:notificationId', notificationController.deleteNotification);
router.delete('/', notificationController.clearAll);

module.exports = router;
