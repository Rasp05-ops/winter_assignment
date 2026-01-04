import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

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

// Auth APIs
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.patch('/profile', data),
};

// Dashboard APIs
export const dashboardAPI = {
  getDashboard: () => api.get('/dashboard'),
  getRecommendedCircles: () => api.get('/dashboard/recommended-circles'),
  getMoodStatus: () => api.get('/dashboard/mood-log-status'),
};

// Mood Log APIs
export const moodAPI = {
  getToday: () => api.get('/mood-logs/today'),
  logMood: (data) => api.post('/mood-logs', data),
  getCalendar: (days = 30) => api.get(`/mood-logs/calendar?days=${days}`),
  getStats: (period = 30) => api.get(`/mood-logs/stats?period=${period}`),
};

// Circle APIs

export default api;

// Circle APIs
export const circleAPI = {
  getAll: (params) => api.get('/circles', { params }),
  getById: (id) => api.get(`/circles/${id}`),
  create: (data) => api.post('/circles', data),
  join: (id) => api.post(`/circles/${id}/join`),
  leave: (id) => api.post(`/circles/${id}/leave`),
  getMembers: (id) => api.get(`/circles/${id}/members`),
  getPosts: (id, params) => api.get(`/circles/${id}/posts`, { params }),
  createPost: (id, data) => api.post(`/circles/${id}/posts`, data),
  getComments: (postId) => api.get(`/circles/posts/${postId}/comments`),
  createComment: (postId, data) => api.post(`/circles/posts/${postId}/comments`, data),
};
