const express = require('express');
const router = express.Router();
const Room = require('../models/SimplifiedRoom');
const User = require('../models/User');
const Message = require('../models/Message');
const File = require('../models/File');

router.post('/initialize-workspace', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let workspaceRoom = null;
    
    if (user.defaultWorkspaceRoomId) {
      workspaceRoom = await Room.findOne({ roomId: user.defaultWorkspaceRoomId });
    }

    if (!workspaceRoom) {
      const workspaceRoomId = await user.initializeWorkspace();
      
      workspaceRoom = new Room({
        roomId: workspaceRoomId,
        name: `${user.username}'s Workspace`,
        description: 'Personal workspace',
        owner: user._id,
        isPrivate: false,
        isPersistent: true,
        isWorkspace: true,
        workspaceOwner: user._id,
        files: []
      });
      
      await workspaceRoom.save();
      console.log(`✅ Created workspace: ${workspaceRoomId}`);
    }
    
    res.json({
      success: true,
      data: { room: workspaceRoom }
    });
    
  } catch (error) {
    console.error('Initialize workspace error:', error);
    res.status(500).json({ success: false, message: 'Error initializing workspace' });
  }
});

router.get('/workspace', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user || !user.defaultWorkspaceRoomId) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    const workspaceRoom = await Room.findOne({ roomId: user.defaultWorkspaceRoomId })
      .populate('owner', 'username profilePicture');
    
    if (!workspaceRoom) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }
    
    res.json({ success: true, data: { room: workspaceRoom } });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ success: false, message: 'Error fetching workspace' });
  }
});
router.get('/', async (req, res) => {
  try {
    const { limit = 10, includeUserRooms = true } = req.query;
    const userId = req.user._id;
    
    let rooms = [];
    
    if (includeUserRooms) {
      rooms = await Room.find({
        $or: [
          { owner: userId },
          { 'participants.user': userId }
        ]
      })
      .populate('owner', 'username profilePicture')
      .sort({ isWorkspace: -1, lastActivity: -1 });
    } else {
      rooms = await Room.find({
        isActive: true,
        isPrivate: false,
        owner: { $ne: userId }
      })
      .populate('owner', 'username profilePicture')
      .sort({ lastActivity: -1 })
      .limit(parseInt(limit));
    }
    
    res.json({ success: true, data: { rooms } });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'Error fetching rooms' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description = '', isPrivate = false } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Room name required' });
    }
    
    let roomId;
    let attempts = 0;
    
    do {
      roomId = Math.floor(10000000 + Math.random() * 90000000).toString();
      const existingRoom = await Room.findOne({ roomId });
      if (!existingRoom) break;
      attempts++;
    } while (attempts < 10);
    
    const room = new Room({
      roomId,
      name: name.trim(),
      description: description.trim(),
      owner: req.user._id,
      isPrivate,
      isPersistent: true,
      isWorkspace: false,
      files: []
    });
    
    await room.save();
    
    const user = await User.findById(req.user._id);
    user.addRoom(roomId, 'owner');
    await user.save();
    
    console.log(`✅ Room created: ${roomId} by ${req.user.username}`);
    
    res.status(201).json({
      success: true,
      data: {
        room: {
          roomId: room.roomId,
          name: room.name,
          description: room.description,
          isPrivate: room.isPrivate,
          accessCode: room.accessCode
        }
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Error creating room' });
  }
});

router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await Room.findOne({ roomId })
      .populate('owner', 'username profilePicture')
      .populate('participants.user', 'username profilePicture');
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    if (room.isPrivate && room.owner._id.toString() !== req.user._id.toString()) {
      const isParticipant = room.participants.some(p => p.user.toString() === req.user._id.toString());
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }
    
    await User.findByIdAndUpdate(req.user._id, {
      currentRoom: roomId,
      lastActivity: new Date()
    });
    
    res.json({
      success: true,
      data: { 
        room: {
          ...room.toObject(),
          roomId: room.roomId
        }
      }
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: 'Error fetching room' });
  }
});

router.post('/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { accessCode } = req.body;
    
    console.log(`User ${req.user.username} joining room: ${roomId}`);
    
    const room = await Room.findOne({ roomId });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    if (room.isPrivate && room.accessCode) {
      if (!accessCode || room.accessCode !== accessCode) {
        return res.status(401).json({ 
          success: false, 
          message: 'This is a private room. Access code required.' 
        });
      }
    }
    
    const user = await User.findById(req.user._id);
    
    const existingParticipant = room.participants.find(
      p => p.user.toString() === user._id.toString()
    );
    
    if (!existingParticipant) {
      room.participants.push({
        user: user._id,
        joinedAt: new Date(),
        lastJoined: new Date(),
        role: 'collaborator'
      });
      room.stats.totalJoins += 1;
    } else {
      existingParticipant.lastJoined = new Date();
    }
    
    room.lastActivity = new Date();
    await room.save();
    
    user.addRoom(roomId, 'participant', accessCode);
    user.setCurrentRoom(roomId);
    await user.save();
    
    console.log(`✅ ${req.user.username} joined room ${roomId} successfully`);
    
    res.json({
      success: true,
      message: 'Joined room successfully',
      data: {
        room: {
          roomId: room.roomId,
          name: room.name,
          description: room.description,
          files: room.files,
          isWorkspace: room.isWorkspace,
          isPersistent: room.isPersistent
        }
      }
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ success: false, message: 'Error joining room' });
  }
});

router.post('/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (roomId === user.defaultWorkspaceRoomId) {
      return res.status(400).json({ success: false, message: 'Cannot leave workspace' });
    }
    
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    if (user.currentRoom === roomId) {
      user.currentRoom = user.defaultWorkspaceRoomId;
    }
    await user.save();
    
    console.log(`✅ ${req.user.username} left room ${roomId}`);
    
    res.json({ success: true, message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ success: false, message: 'Error leaving room' });
  }
});

router.put('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const updates = req.body;
    
    const room = await Room.findOne({ roomId });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    if (room.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only owner can update' });
    }
    
    const allowedFields = ['name', 'description', 'isPrivate', 'editorSettings', 'roomSettings'];
    const filteredUpdates = {};
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });
    
    if (room.isWorkspace) {
      delete filteredUpdates.isPrivate;
    }
    
    filteredUpdates.lastActivity = new Date();
    
    const updatedRoom = await Room.findOneAndUpdate(
      { roomId },
      filteredUpdates,
      { new: true }
    );
    
    res.json({ success: true, data: { room: updatedRoom } });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ success: false, message: 'Error updating room' });
  }
});

router.delete('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const user = await User.findById(req.user._id);
    
    console.log(`User ${req.user.username} attempting to delete room: ${roomId}`);
    
    if (roomId === user.defaultWorkspaceRoomId) {
      return res.status(400).json({ success: false, message: 'Cannot delete workspace' });
    }
    
    const room = await Room.findOne({ roomId });
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    if (room.owner.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only owner can delete' });
    }
    
    if (room.isWorkspace) {
      return res.status(400).json({ success: false, message: 'Cannot delete workspace' });
    }
    
    console.log(`Starting deletion of room: ${room.name}`);
    
    const io = req.app.get('io');
    if (io) {
      io.to(`room-${roomId}`).emit('room-deleted', {
        roomId,
        roomName: room.name,
        deletedBy: user._id.toString(),
        deletedByUsername: req.user.username,
        redirectTo: {
          type: 'workspace',
          roomId: user.defaultWorkspaceRoomId
        },
        timestamp: new Date()
      });
      console.log(`📡 Broadcasted room-deleted event to room-${roomId}`);
    }
    
    const deletedMessagesResult = await Message.deleteMany({
      $or: [
        { room: roomId },
        { room: `room-${roomId}` }
      ]
    });
    console.log(`Deleted ${deletedMessagesResult.deletedCount} messages from room`);
    
    const fileCount = room.files.length;
    
    await User.updateMany(
      { 'rooms.roomId': roomId },
      { 
        $pull: { rooms: { roomId: roomId } },
        $set: { currentRoom: null }
      }
    );
    console.log(`Removed room from all users' lists`);
    
    await Room.findOneAndDelete({ roomId });
    
    console.log(`Room ${room.name} deleted from database`);
    
    res.json({ 
      success: true, 
      message: 'Room deleted successfully',
      data: {
        deletedFiles: fileCount,
        deletedMessages: deletedMessagesResult.deletedCount,
        roomName: room.name
      }
    });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting room',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;