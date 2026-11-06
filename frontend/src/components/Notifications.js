import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../services/api';

function Notifications() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // 1. Poll for unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // 2. Close dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationAPI.getUnreadCount();
      setUnreadCount(res.data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notification count');
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll({ limit: 10 });
      setNotifications(res.data.notifications);
      
      // If we open the list, assume user saw them? 
      // Usually better to let user manually click or "Mark all read"
    } catch (error) {
      console.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleMarkRead = async (e, id) => {
    e.stopPropagation();
    try {
      await notificationAPI.markRead(id);
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all read');
    }
  };

  const handleClickNotification = (notification) => {
    // Navigate based on type (Customize these paths based on your app)
    if (notification.type === 'comment' || notification.type === 'like') {
      navigate(`/circles/${notification.referenceId}`); // Assuming referenceId is circle ID or Post ID
    } else if (notification.type === 'join_request') {
      navigate(`/circles/${notification.referenceId}`); 
    }
    
    // Mark as read when clicked
    if (!notification.isRead) {
      handleMarkRead({ stopPropagation: () => {} }, notification.id);
    }
    setIsOpen(false);
  };

  // Helper to generate text based on notification type
  const getNotificationText = (n) => {
    const actorName = n.actor?.displayName || n.actor?.username || 'Someone';
    
    switch (n.type) {
      case 'comment': return <span><span className="font-bold">{actorName}</span> commented on your post.</span>;
      case 'like': return <span><span className="font-bold">{actorName}</span> liked your post.</span>;
      case 'join_request': return <span><span className="font-bold">{actorName}</span> requested to join your circle.</span>;
      case 'circle_invite': return <span><span className="font-bold">{actorName}</span> invited you to a circle.</span>;
      default: return <span><span className="font-bold">{actorName}</span> sent a notification.</span>;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button 
        onClick={toggleDropdown}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 outline-none"
      >
        <span className="text-sm">Notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-dark-bg animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-slide-up origin-top-right">
          
          {/* Header */}
          <div className="p-4 border-b border-dark-border flex justify-between items-center bg-dark-bg/50 backdrop-blur-md">
            <h3 className="font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="text-xs text-accent-blue hover:text-accent-purple transition-colors font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <span className="text-sm">No notifications yet</span>
              </div>
            ) : (
              <div>
                {notifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`p-4 border-b border-dark-border hover:bg-white/5 transition-colors cursor-pointer flex items-start space-x-3 ${
                      !n.isRead ? 'bg-accent-blue/5' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex-shrink-0 flex items-center justify-center text-lg overflow-hidden">
                      {n.actor?.profilePicture ? (
                        <img src={n.actor.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        ''
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <p className="text-sm text-gray-300 leading-snug">
                        {getNotificationText(n)}
                      </p>
                      <span className="text-[10px] text-gray-500 mt-1 block">
                        {new Date(n.createdAt).toLocaleDateString()} • {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>

                    {/* Unread Dot */}
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-accent-blue rounded-full mt-2"></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-2 border-t border-dark-border bg-dark-bg/50 text-center">
            <button className="text-xs text-gray-500 hover:text-white transition-colors">
              View All History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;