const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ML-backed endpoints cost real compute: cap per-user bursts.
const mlLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: 'Too many requests, slow down a little' }
});

// Validation
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

const createJournalValidation = [
  body('title')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be 1-200 characters'),
  body('body')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Body must be 1-10000 characters'),
  body('visibility')
    .optional()
    .isIn(['private', 'circles', 'public'])
    .withMessage('Invalid visibility'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

// All routes require authentication

router.use(authenticate);
router.get('/public', journalController.getPublicJournals);

// ML-powered (must be registered before '/:journalId')
router.get('/search/semantic', mlLimiter, journalController.semanticSearch);
router.get('/sentiment/trend', journalController.getSentimentTrend);
router.post('/reindex', mlLimiter, journalController.reindexMyJournals);


// CRUD operations
router.get('/', journalController.getMyJournals);
router.get('/stats', journalController.getJournalStats);
router.get('/tags', journalController.getAllTags);
router.get('/tag/:tag', journalController.getJournalsByTag);
router.get('/circle/:circleId', journalController.getCircleJournals);
router.get('/:journalId', journalController.getJournal);
router.post('/', validate(createJournalValidation), journalController.createJournal);
router.patch('/:journalId', journalController.updateJournal);
router.delete('/:journalId', journalController.deleteJournal);
router.post('/:journalId/favorite', journalController.toggleFavorite);
router.get('/:journalId/similar', mlLimiter, journalController.getSimilarJournals);
router.post('/:journalId/reanalyze', mlLimiter, journalController.reanalyzeJournal);

module.exports = router;
