import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.patch('/profile', data),
};

export const dashboardAPI = {
  getDashboard: () => api.get('/dashboard'),
  getRecommendedCircles: () => api.get('/dashboard/recommended-circles'),
  getMoodStatus: () => api.get('/dashboard/mood-log-status'),
};

export const moodAPI = {
  getToday: () => api.get('/mood-logs/today'),
  logMood: (data) => api.post('/mood-logs', data),
  getCalendar: (days = 30) => api.get(`/mood-logs/calendar?days=${days}`),
  getStats: (period = 30) => api.get(`/mood-logs/stats?period=${period}`),
  getByDate: (date) => api.get(`/mood-logs/date/${date}`),
};

export const circleAPI = {
  getAll: (params) => api.get('/circles', { params }),
  getById: (id) => api.get(`/circles/${id}`),
  create: (data) => api.post('/circles', data),
  join: (id) => api.post(`/circles/${id}/join`),
  leave: (id) => api.post(`/circles/${id}/leave`),
  getJoinRequests: (circleId) => api.get(`/circles/${circleId}/join-requests`),
  approveRequest: (circleId, membershipId) => api.post(`/circles/${circleId}/join-requests/${membershipId}/approve`),
  rejectRequest: (circleId, membershipId) => api.post(`/circles/${circleId}/join-requests/${membershipId}/reject`),
  
  // getMembers: (circleId) => api.get(`/circles/${circleId}/members`),
  removeMember: (circleId, memberId) => api.delete(`/circles/${circleId}/members/${memberId}`),
  promoteMember: (circleId, memberId) => api.patch(`/circles/${circleId}/members/${memberId}/promote`),
  
  updateCircle: (circleId, data) => api.patch(`/circles/${circleId}`, data),
  getMembers: (id) => api.get(`/circles/${id}/members`),
  getPosts: (id, params) => api.get(`/circles/${id}/posts`, { params }),
  createPost: (id, data) => api.post(`/circles/${id}/posts`, data),
  getComments: (postId) => api.get(`/circles/posts/${postId}/comments`),
  createComment: (postId, content) => api.post(`/circles/posts/${postId}/comments`, { content }),
  deletePost: (postId) => api.delete(`/circles/posts/${postId}`),
  updatePost: (postId, content) => api.patch(`/circles/posts/${postId}`, { content }),
  getMyCircles: () => api.get('/circles/my-circles'),

  // NEW: Modify/Delete Comments
  deleteComment: (commentId) => api.delete(`/circles/comments/${commentId}`),
  updateComment: (commentId, content) => api.patch(`/circles/comments/${commentId}`, { content }),
};

export const journalAPI = {
  getAll: () => api.get('/journals'),
  getMyJournals: () => api.get('/journals'),
  
  getStats: () => api.get('/journals/stats'),
  
  create: (data) => api.post('/journals', data),
  
  update: (id, data) => api.patch(`/journals/${id}`, data),
  
  delete: (id) => api.delete(`/journals/${id}`),
  
  toggleFavorite: (id) => api.post(`/journals/${id}/favorite`),
  getPublic: () => api.get('/journals/public'),
  getByCircle: (circleId) => api.get(`/journals/circle/${circleId}`),
  getByTag: (tag) => api.get(`/journals/tag/${tag}`),

  // ML-powered
  semanticSearch: (q, limit = 10) =>
    api.get('/journals/search/semantic', { params: { q, limit } }),
  getSimilar: (id, limit = 5) => api.get(`/journals/${id}/similar`, { params: { limit } }),
  getSentimentTrend: (days = 30) => api.get('/journals/sentiment/trend', { params: { days } }),
  reanalyze: (id) => api.post(`/journals/${id}/reanalyze`),
};
// Add this to your existing api.js file

export const searchAPI = {
  // Global Search (Circles, Users, Journals)
  searchAll: (query) => api.get(`/search?query=${query}`),
  
  // Specific Circle Search with Filters
  searchCircles: (params) => api.get('/search/circles', { params }),
  searchUsers: (query) => api.get(`/search/users?query=${query}`),
  // Get Discover/Recommendations
  getDiscover: (limit = 10) => api.get(`/search/discover?limit=${limit}`),
  
  // Get Trending
  getTrending: (limit = 10) => api.get(`/search/trending?limit=${limit}`),
  
  // Get available filters (Tags/Categories)
  getFilters: () => api.get('/search/filters'),
};

// Add this to your existing api.js file

export const notificationAPI = {
  // Get list of notifications
  getAll: (params) => api.get('/notifications', { params }),
  
  // Get just the count (lighter request for polling)
  getUnreadCount: () => api.get('/notifications/unread-count'),
  
  // Mark specific one as read
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  
  // Mark all as read
  markAllRead: () => api.post('/notifications/mark-all-read'),
  
  // Delete one
  delete: (id) => api.delete(`/notifications/${id}`),
  
  // Clear all
  clearAll: () => api.delete('/notifications'),
};
// Add these to your export const authAPI = { ... } OR create a new userAPI object

export const userAPI = {
  // Get current profile
  getProfile: () => api.get('/profile'),

  // Update text details (JSON)
  updateProfile: (data) => api.patch('/profile', data),

  // Upload Profile Picture (Multipart)
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file); // Note: Ensure 'image' matches the field name in your multer middleware config on backend
    return api.post('/profile/picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Reset to default
  deleteAvatar: () => api.delete('/profile/picture'),
};
export default api;
