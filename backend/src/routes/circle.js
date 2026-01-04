// src/routes/circle.js
const express = require('express');
const router = express.Router();
const circleController = require('../controllers/circleController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = require('express-validator').validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({ 
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  };
};

const createCircleValidation = [
  body('name').isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description max 1000 characters'),
  body('category').isIn(['anxiety', 'depression', 'stress', 'productivity', 'mindfulness', 'relationships', 'other']).withMessage('Invalid category'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('isPrivate').optional().isBoolean().withMessage('isPrivate must be boolean')
];

const createPostValidation = [
  body('content').isLength({ min: 1, max: 5000 }).withMessage('Content must be 1-5000 characters'),
  body('type').optional().isIn(['text', 'image', 'poll', 'resource']).withMessage('Invalid post type')
];

const createCommentValidation = [
  body('content').isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters')
];

// All routes require authentication
router.use(authenticate);
router.get('/my-circles', authenticate, circleController.getMyCircles);

// ===== CIRCLE MANAGEMENT =====
router.get('/', circleController.getAllCircles);
router.get('/:circleId', circleController.getCircle);
router.post('/', validate(createCircleValidation), circleController.createCircle);
router.post('/:circleId/join', circleController.joinCircle);
router.post('/:circleId/leave', circleController.leaveCircle);

// ===== CIRCLE ADMIN =====
router.get('/:circleId/members', circleController.getMembers);
router.get('/:circleId/join-requests', circleController.getJoinRequests);
router.post('/:circleId/join-requests/:membershipId/approve', circleController.approveRequest);
router.post('/:circleId/join-requests/:membershipId/reject', circleController.rejectRequest);
router.patch('/:circleId', circleController.updateCircle);
router.delete('/:circleId/members/:memberId', circleController.removeMember);
router.patch('/:circleId/members/:memberId/promote', circleController.promoteMember);

// ===== CIRCLE FEED (POSTS) =====
router.get('/:circleId/posts', circleController.getPosts);
router.post('/:circleId/posts', validate(createPostValidation), circleController.createPost);
router.patch('/posts/:postId', validate(createPostValidation), circleController.updatePost);
router.delete('/posts/:postId', circleController.deletePost);

// ===== COMMENTS =====
router.get('/posts/:postId/comments', circleController.getComments);
router.post('/posts/:postId/comments', validate(createCommentValidation), circleController.createComment);
router.patch('/comments/:commentId', validate(createCommentValidation), circleController.updateComment);
router.delete('/comments/:commentId', circleController.deleteComment);

module.exports = router;