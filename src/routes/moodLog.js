const express = require('express');
const router = express.Router();
const moodLogController = require('../controllers/moodLogController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = require('express-validator').validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(400).json({ 
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  };
};

const logMoodValidation = [
  body('mood')
    .isIn(['good', 'neutral', 'bad'])
    .withMessage('Mood must be: good, neutral, or bad'),
  body('emotions')
    .optional()
    .isArray()
    .withMessage('Emotions must be an array'),
  body('activities')
    .optional()
    .isArray()
    .withMessage('Activities must be an array'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes max 1000 characters'),
  body('visibility')
    .optional()
    .isIn(['private', 'circles', 'public'])
    .withMessage('Invalid visibility option')
];

router.use(authenticate);
router.get('/today', moodLogController.getTodayMood);
router.post('/', validate(logMoodValidation), moodLogController.logMood);
router.get('/date/:date', moodLogController.getMoodByDate);
router.delete('/date/:date', moodLogController.deleteMoodLog);

router.get('/range', moodLogController.getMoodRange);
router.get('/calendar', moodLogController.getMoodCalendar);
router.get('/stats', moodLogController.getMoodStats);

router.patch('/date/:date/visibility', moodLogController.updateVisibility);
router.get('/circle/:circleId', moodLogController.getCircleMoodLogs);
router.post('/auto-fill', moodLogController.autoFillMissedDays);

module.exports = router;
