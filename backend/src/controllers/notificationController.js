const Notification = require('../models/Notification');
const User = require('../models/User');
const { Op } = require('sequelize');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const { limit = 20, offset = 0, unreadOnly } = req.query;
    let where = { userId: req.userId };

    // Filter unread only
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await Notification.findAll({
      where,
      include: [{
        model: User,
        as: 'actor',
        attributes: ['id', 'username', 'displayName', 'profilePicture']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const unreadCount = await Notification.count({
      where: { userId: req.userId, isRead: false }
    });

    res.json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: { userId: req.userId, isRead: false }
    });

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.userId) {
      return res.status(403).json({ error: 'Not your notification' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({
      success: true,
      message: 'Marked as read',
      notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.userId, isRead: false } }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== req.userId) {
      return res.status(403).json({ error: 'Not your notification' });
    }

    await notification.destroy();

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// Clear all notifications
exports.clearAll = async (req, res) => {
  try {
    await Notification.destroy({
      where: { userId: req.userId }
    });

    res.json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    console.error('Clear all error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
};

// Create notification (helper function - used by other controllers)
exports.createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};
