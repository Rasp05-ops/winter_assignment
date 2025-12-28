const User = require('../models/User');
const fs = require('fs');
const path = require('path');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    res.json({
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while fetching profile' 
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { displayName, bio, interests } = req.body;
    const user = await User.findByPk(req.userId);
    
    // Update only provided fields
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (interests !== undefined) {
      // Filter, trim, and limit interests
      user.interests = interests
        .filter(interest => interest && interest.trim())
        .map(interest => interest.trim())
        .slice(0, 20);
    }
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while updating profile' 
    });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please select an image file to upload' 
      });
    }
    
    const user = await User.findByPk(req.userId);
    
    // Delete old profile picture if not default
    if (user.profilePicture !== 'default-avatar.png') {
      const oldPicturePath = path.join(
        process.env.UPLOAD_PATH || './uploads/profile-pictures',
        user.profilePicture
      );
      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
      }
    }
    
    // Update user with new picture
    user.profilePicture = req.file.filename;
    await user.save();
    
    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: req.file.filename,
      url: `/uploads/profile-pictures/${req.file.filename}`
    });
  } catch (error) {
    console.error('Upload picture error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while uploading picture' 
    });
  }
};

exports.deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    
    // Delete current profile picture if not default
    if (user.profilePicture !== 'default-avatar.png') {
      const picturePath = path.join(
        process.env.UPLOAD_PATH || './uploads/profile-pictures',
        user.profilePicture
      );
      if (fs.existsSync(picturePath)) {
        fs.unlinkSync(picturePath);
      }
    }
    
    user.profilePicture = 'default-avatar.png';
    await user.save();
    
    res.json({
      message: 'Profile picture reset to default',
      profilePicture: 'default-avatar.png'
    });
  } catch (error) {
    console.error('Delete picture error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'An error occurred while deleting picture' 
    });
  }
};
