const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(authenticate);

// Main dashboard route
router.get('/', dashboardController.getDashboard);

// Individual components
router.get('/recommended-circles', dashboardController.getRecommendedCircles);
router.get('/circle-updates', dashboardController.getCircleUpdates);
router.get('/mood-log-status', dashboardController.checkTodayMoodLog);
router.get('/journals', dashboardController.getQuickAccessJournals);

module.exports = router;
