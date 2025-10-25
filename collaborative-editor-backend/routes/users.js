const express = require('express');
const User = require('../models/User');
const { verifyToken } = require('../auth');

const router = express.Router();

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId)
      .select('-password -googleId -githubId -microsoftId -emailVerificationToken -passwordResetToken')
      .populate('ownedProjects', 'name description primaryLanguage')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user._id.toString() !== req.user._id.toString() && user.privacy) {
      if (user.privacy.profileVisibility === 'private') {
        return res.status(403).json({
          success: false,
          message: 'This profile is private'
        });
      }
      
      if (!user.privacy.showEmail) {
        delete user.email;
      }
      
      if (!user.privacy.showProjects) {
        delete user.ownedProjects;
        delete user.collaboratingProjects;
        delete user.favoriteProjects;
      }
      
      delete user.preferences;
      delete user.notificationSettings;
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user'
    });
  }
});
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -googleId -githubId -microsoftId -emailVerificationToken -passwordResetToken')
      .populate('ownedProjects', 'name description primaryLanguage')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user profile'
    });
  }
});

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const allowedFields = [
      'fullName',
      'displayName',
      'bio',
      'profilePicture',
      'location',
      'website',
      'company',
      'jobTitle'
    ];
    
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    const user = await User.findByIdAndUpdate(
      userId, 
      updateData,
      { new: true, runValidators: true }
    ).select('-password -googleId -githubId -emailVerificationToken -passwordResetToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

router.put('/preferences', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({
        success: false,
        message: 'Preferences object is required'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { preferences },
      { new: true }
    ).select('preferences');
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating preferences'
    });
  }
});

router.put('/privacy', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { privacy } = req.body;
    
    if (!privacy) {
      return res.status(400).json({
        success: false,
        message: 'Privacy object is required'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { privacy },
      { new: true }
    ).select('privacy');
    
    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: { privacy: user.privacy }
    });
  } catch (error) {
    console.error('Update privacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating privacy settings'
    });
  }
});

router.get('/search', verifyToken, async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const searchConditions = {
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      status: 'active'
    };
  
    searchConditions['privacy.profileVisibility'] = { $ne: 'private' };
    
    const users = await User.find(searchConditions)
      .limit(parseInt(limit))
      .select('username fullName email profilePicture bio')
      .lean();
    
    res.json({
      success: true,
      data: { users, count: users.length }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users'
    });
  }
});

module.exports = router;