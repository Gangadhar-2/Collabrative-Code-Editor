const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Room = require('../models/SimplifiedRoom');

router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 100, before, channel = 'chat' } = req.query;

    console.log(`Getting messages for room: ${roomId}, channel: ${channel}`);

    const room = await Room.findOne({ roomId }).lean();
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const hasAccess = room.owner.toString() === req.user._id.toString() ||
                     room.participants.some(p => p.user.toString() === req.user._id.toString()) ||
                     !room.isPrivate;

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const query = { 
      $or: [
        { room: roomId },
        { room: `room-${roomId}` }
      ],
      channel: channel,
      isDeleted: false
    };
    
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username profilePicture')
      .lean();

    const chronologicalMessages = messages.reverse();

    console.log(`Found ${chronologicalMessages.length} messages for room ${roomId}, channel: ${channel}`);

    res.json({
      success: true,
      data: {
        messages: chronologicalMessages,
        hasMore: messages.length === parseInt(limit),
        roomId,
        channel
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Error retrieving messages' });
  }
});

router.post('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message, type = 'text', channel = 'chat' } = req.body;

    console.log(`Sending message to room ${roomId}, channel: ${channel}`);

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content required' });
    }

    if (message.trim().length > 5000) {
      return res.status(400).json({ success: false, message: 'Message too long (max 5000 characters)' });
    }

    const room = await Room.findOne({ roomId }).lean();
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const newMessage = new Message({
      room: `room-${roomId}`,
      channel: channel,
      sender: req.user._id,
      content: message.trim(),
      type,
      senderUsername: req.user.username,
      senderAvatar: req.user.profilePicture,
      timestamp: new Date()
    });

    const savedMessage = await newMessage.save();
    console.log(`Message saved with channel: ${channel}`);

    await savedMessage.populate('sender', 'username profilePicture');

    const messageData = {
      id: savedMessage._id,
      message: savedMessage.content,
      content: savedMessage.content,
      channel: channel,
      user: {
        id: req.user._id,
        username: req.user.username,
        profilePicture: req.user.profilePicture
      },
      sender: {
        _id: req.user._id,
        username: req.user.username,
        profilePicture: req.user.profilePicture
      },
      timestamp: savedMessage.timestamp,
      type: savedMessage.type
    };

    const io = req.app.get('io');
    if (io) {
      console.log(`Broadcasting message to room-${roomId}, channel: ${channel}`);
      io.to(`room-${roomId}`).emit('new-message', messageData);
    }

    res.status(201).json({
      success: true,
      data: {
        message: {
          id: savedMessage._id,
          content: savedMessage.content,
          channel: channel,
          timestamp: savedMessage.timestamp,
          type: savedMessage.type,
          sender: savedMessage.sender
        }
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
});

router.delete('/room/:roomId/clear', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { channel = 'chat' } = req.query;

    console.log(`Clearing messages for room ${roomId}, channel: ${channel}, user: ${req.user.username}`);

    const room = await Room.findOne({ roomId }).lean();
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const hasAccess = room.owner.toString() === req.user._id.toString() ||
                     room.participants.some(p => p.user.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await Message.deleteMany({
      $or: [
        { room: roomId },
        { room: `room-${roomId}` }
      ],
      channel: channel
    });

    console.log(`Deleted ${result.deletedCount} messages from room ${roomId}`);

    const io = req.app.get('io');
    if (io) {
      io.to(`room-${roomId}`).emit('chat-cleared', {
        roomId,
        channel,
        clearedBy: {
          id: req.user._id,
          username: req.user.username
        },
        timestamp: new Date()
      });
      console.log(`Broadcasted chat-cleared event to room-${roomId}`);
    }

    res.json({
      success: true,
      message: 'Chat cleared successfully',
      data: {
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({ success: false, message: 'Error clearing chat' });
  }
});

module.exports = router;