const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const notificationRoutes = require('./routes/notification');

const dashboardRoutes = require('./routes/dashboard');
const circleRoutes = require('./routes/circle');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const moodLogRoutes = require('./routes/moodLog');
const journalRoutes = require('./routes/journal');
const searchRoutes = require('./routes/search');

const app = express();

/* =======================
   Security & Core Middleware
   ======================= */
app.use(helmet());

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =======================
   Static Files
   ======================= */
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/* =======================
   API Routes
   ======================= */
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/mood-logs', moodLogRoutes);
app.use('/api/search', searchRoutes);

/* =======================
   Health Check
   ======================= */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/* =======================
   404 Handler (KEEP LAST)
   ======================= */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});
app.use('/api/notifications', notificationRoutes);


/* =======================
   Global Error Handler
   ======================= */
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'File size exceeds the maximum allowed size (5MB)'
    });
  }

  // Invalid file type error
  if (err.message && err.message.includes('Only image files')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

module.exports = app;
