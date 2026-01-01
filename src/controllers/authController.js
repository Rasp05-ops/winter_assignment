const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Op } = require('sequelize');

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

exports.signup = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { username }
        ]
      }
    });
    
    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(409).json({
        error: 'User already exists',
        message: `A user with this ${field} already exists`,
        field
      });
    }
    
    // Create new user
    const user = await User.create({
      email,
      username,
      password
    });
    
    // Generate token
    const token = generateToken(user.id);
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during signup' 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    // Find user by email or username
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier.toLowerCase() },
          { username: identifier }
        ]
      }
    });
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email/username or password is incorrect'
      });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email/username or password is incorrect'
      });
    }
    
    // Generate token
    const token = generateToken(user.id);
    
    res.json({
      message: 'Login successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred during login' 
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.userId);
    
    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid password',
        message: 'Current password is incorrect' 
      });
    }
    user.password = newPassword;
    await user.save();
    
    res.json({ 
      message: 'Password changed successfully',
      success: true 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while changing password' 
    });
  }
};

