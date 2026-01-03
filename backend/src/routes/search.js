const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Unified search
router.get('/', searchController.searchAll);

// Search circles with filters
router.get('/circles', searchController.searchCircles);

// Search users
router.get('/users', searchController.searchUsers);

// Discovery & recommendations
router.get('/discover', searchController.discoverCircles);
router.get('/trending', searchController.getTrendingCircles);
router.get('/filters', searchController.getFilters);

module.exports = router;
