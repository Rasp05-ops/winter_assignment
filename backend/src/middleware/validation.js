const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

const signupValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('pls check your email '),
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('check limits!!!')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('only lettera,no.s,underscores allowed'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate
];

const loginValidation = [
  body('identifier')
    .notEmpty()
    .withMessage('Email or username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

const profileUpdateValidation = [
  body('displayName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Display name must be 50 characters or less'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be 500 characters or less'),
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array'),
  body('interests.*')
    .optional()
    .isLength({ max: 30 })
    .withMessage('Each interest must be 30 characters or less'),
  validate
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate
];

module.exports = {
  signupValidation,
  loginValidation,
  profileUpdateValidation,
  changePasswordValidation
};
