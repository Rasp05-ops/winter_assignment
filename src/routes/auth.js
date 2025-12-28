const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { 
  signupValidation, 
  loginValidation,
  changePasswordValidation 
} = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many requests',
    message: 'Too many authentication attempts. Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes
router.post('/signup', authLimiter, signupValidation, authController.signup);
router.post('/login', authLimiter, loginValidation, authController.login);

// Protected routes
router.post('/change-password', authenticate, changePasswordValidation, authController.changePassword);

module.exports = router;

// ==================== src/routes/profile.js ====================
