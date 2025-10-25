const express = require('express');
const Message = require('../models/Message');
const Project = require('../models/Project');
const { verifyToken } = require('../auth');

const router = express.Router();

router.get('/project/:projectId/messages', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 50, before, channel = 'general' } = req.query;

    console.log(`Getting messages for project: ${projectId}, channel: ${channel}`);

    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(projectId).select('owner collaborators isPublic room').lean();
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const hasAccess = project.owner.toString() === req.user._id.toString() ||
                     project.collaborators.some(c => c.user.toString() === req.user._id.toString()) ||
                     project.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const query = { 
      project: projectId,
      channel: channel,
      isDeleted: false,
      deletedForUsers: { $ne: req.user._id }
    };
    
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username email profilePicture')
      .lean();

    const chronologicalMessages = messages.reverse();

    console.log(`Found ${chronologicalMessages.length} messages for project ${projectId}`);

    res.json({
      success: true,
      data: {
        messages: chronologicalMessages,
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get project messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving project messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/project/:projectId/messages', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message, channel = 'general' } = req.body;

    console.log(`Sending message to project ${projectId}, channel: ${channel}, user: ${req.user.username}`);

    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    if (message.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message too long. Maximum 5000 characters allowed.'
      });
    }

    const project = await Project.findById(projectId).select('owner collaborators isPublic room').lean();
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const hasAccess = project.owner.toString() === req.user._id.toString() ||
                     project.collaborators.some(c => c.user.toString() === req.user._id.toString()) ||
                     project.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const newMessage = new Message({
      project: projectId,
      channel,
      sender: req.user._id,
      content: message.trim(),
      type: 'text',
      senderUsername: req.user.username,
      senderAvatar: req.user.profilePicture,
      timestamp: new Date(),
      room: project.room?.roomId ? `room-${project.room.roomId}` : null
    });

    const savedMessage = await newMessage.save();
    console.log(`Message saved to DB with ID: ${savedMessage._id}`);

    await savedMessage.populate('sender', 'username email profilePicture');

    const messageData = {
      id: savedMessage._id,
      message: savedMessage.content,
      channel,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        profilePicture: req.user.profilePicture
      },
      timestamp: savedMessage.timestamp
    };

    const io = req.app.get('io');
    if (io && project.room?.roomId) {
      console.log(`Broadcasting message to room-${project.room.roomId}`);
      io.to(`room-${project.room.roomId}`).emit('new-message', messageData);
    }

    res.status(201).json({
      success: true,
      data: {
        message: {
          id: savedMessage._id,
          content: savedMessage.content,
          channel: savedMessage.channel,
          timestamp: savedMessage.timestamp,
          sender: savedMessage.sender
        }
      }
    });
  } catch (error) {
    console.error('Send project message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.delete('/project/:projectId/clear', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { channel = 'general' } = req.query;

    console.log(`Clearing messages for project ${projectId}, channel: ${channel}, user: ${req.user.username}`);

    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(projectId).select('owner collaborators isPublic room').lean();
    
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const hasAccess = project.owner.toString() === req.user._id.toString() ||
                     project.collaborators.some(c => c.user.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await Message.deleteMany({
      project: projectId,
      channel: channel
    });

    console.log(`Deleted ${result.deletedCount} messages from project ${projectId}`);

    const io = req.app.get('io');
    if (io && project.room?.roomId) {
      io.to(`room-${project.room.roomId}`).emit('chat-cleared', {
        projectId,
        channel,
        clearedBy: {
          id: req.user._id,
          username: req.user.username
        },
        timestamp: new Date()
      });
      console.log(`Broadcasted chat-cleared event to project room`);
    }

    res.json({
      success: true,
      message: 'Chat cleared successfully',
      data: {
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Clear project chat error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error clearing chat',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;