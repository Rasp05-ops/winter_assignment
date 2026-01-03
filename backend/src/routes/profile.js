const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');
const { profileUpdateValidation } = require('../middleware/validation');
const upload = require('../middleware/upload');

// All profile routes require authentication
router.use(authenticate);

router.get('/', profileController.getProfile);
router.patch('/', profileUpdateValidation, profileController.updateProfile);
router.post('/picture', upload.single('profilePicture'), profileController.uploadProfilePicture);
router.delete('/picture', profileController.deleteProfilePicture);

module.exports = router;
