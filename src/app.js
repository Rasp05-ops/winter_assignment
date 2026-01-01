const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const dashboardRoutes = require('./routes/dashboard');
const circleRoutes = require('./routes/circle');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const moodLogRoutes = require('./routes/moodLog');


const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: 'The requested resource was not found' 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      error: 'File too large',
      message: 'File size exceeds the maximum allowed size (5MB)' 
    });
  }
  
  if (err.message && err.message.includes('Only image files')) {
    return res.status(400).json({ 
      error: 'Invalid file type',
      message: err.message 
    });
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error',
    message: 'An unexpected error occurred'
  });
});
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/mood-logs', moodLogRoutes);




module.exports = app;
