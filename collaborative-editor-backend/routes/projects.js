const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const File = require('../models/File');
const Message = require('../models/Message');
const Room = require('../models/SimplifiedRoom');
const { verifyToken } = require('../auth');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
      limit = 20, 
      page = 1, 
      sortBy = 'lastActivity',
      order = 'desc',
      search = '',
      language = '',
      type = '',
      roomId = null
    } = req.query;

    const userId = req.user._id;
    
    const query = {
      status: 'active'
    };

    if (roomId) {
      query['room.roomId'] = roomId;
      console.log(`Filtering projects for room: ${roomId}`);
    } else {
      query.$or = [
        { owner: userId },
        { 'collaborators.user': userId }
      ];
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (language) {
      query.primaryLanguage = language;
    }

    if (type) {
      query.projectType = type;
    }

    const projects = await Project.find(query)
      .populate('owner', 'username email profilePicture')
      .populate('collaborators.user', 'username email profilePicture')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Project.countDocuments(query);

    console.log(`Found ${projects.length} projects for room ${roomId || 'any'}`);

    res.json({
      success: true,
      data: {
        projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects'
    });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { 
      name, 
      description = '', 
      projectType = 'web',
      primaryLanguage = 'javascript',
      programmingLanguage,
      framework = 'none',
      isPublic = true,
      roomId 
    } = req.body;

    console.log('Creating project with data:', { 
      name, 
      description, 
      projectType, 
      primaryLanguage, 
      programmingLanguage, 
      framework, 
      isPublic, 
      roomId,
      userId: req.user._id 
    });

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }

    const finalLanguage = programmingLanguage || primaryLanguage;
    let targetRoomId = roomId;
    
    if (!targetRoomId) {
      const user = await User.findById(req.user._id).select('currentRoom defaultWorkspaceRoomId');
      targetRoomId = user.currentRoom || user.defaultWorkspaceRoomId;
    }

    if (!targetRoomId) {
      return res.status(400).json({
        success: false,
        message: 'No active room found. Please join a room first.'
      });
    }

    console.log(`Creating project in room: ${targetRoomId}`);

    const project = new Project({
      name: name.trim(),
      description: description ? description.trim() : '',
      projectType,
      primaryLanguage: finalLanguage,
      framework,
      isPublic: true,
      owner: req.user._id,
      visibility: 'public',
      status: 'active',
      room: {
        roomId: targetRoomId,
        maxUsers: 10
      }
    });

    await project.save();
    console.log('Project saved with ID:', project._id, 'in Room:', targetRoomId);

    const populatedProject = await Project.findById(project._id)
      .populate('owner', 'username email profilePicture');

    console.log('Project creation successful:', populatedProject.name);

    const io = req.app.get('io');
    if (io && targetRoomId) {
      io.to(`room-${targetRoomId}`).emit('project-created', {
        project: populatedProject,
        user: {
          id: req.user._id,
          username: req.user.username
        },
        roomId: targetRoomId,
        timestamp: new Date()
      });
      console.log(`📡 Broadcasted project-created event to room-${targetRoomId}`);
    }

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: { 
        project: populatedProject
      }
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const projectId = req.params.id;

    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(projectId)
      .populate('owner', 'username email profilePicture')
      .populate('collaborators.user', 'username email profilePicture')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const hasAccess = project.owner._id.toString() === req.user._id.toString() ||
                     project.collaborators.some(c => c.user._id.toString() === req.user._id.toString()) ||
                     project.isPublic;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { project }
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project'
    });
  }
});

router.put('/:id', verifyToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const updates = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    const isAdmin = project.collaborators.some(
      c => c.user.toString() === req.user._id.toString() && c.role === 'admin'
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only project owner or admin can update.'
      });
    }

    const allowedFields = [
      'name',
      'description',
      'projectType',
      'primaryLanguage',
      'framework',
      'editorSettings',
      'buildConfig'
    ];

    const filteredUpdates = {};
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    filteredUpdates.isPublic = true;
    filteredUpdates.visibility = 'public';
    filteredUpdates.lastActivity = new Date();

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('owner', 'username email profilePicture');

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: { project: updatedProject }
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project'
    });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user._id;

    console.log(`User ${req.user.username} attempting to delete project: ${projectId}`);

    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only project owner can delete the project.'
      });
    }

    console.log(`Starting deletion of project: ${project.name}`);

    const deletedFilesResult = await File.deleteMany({ project: projectId });
    console.log(`Deleted ${deletedFilesResult.deletedCount} files from project`);

    const deletedMessagesResult = await Message.deleteMany({ project: projectId });
    console.log(`Deleted ${deletedMessagesResult.deletedCount} messages from project`);

    const user = await User.findById(userId).select('defaultWorkspaceRoomId currentRoom');
    const redirectRoomId = user.defaultWorkspaceRoomId || user.currentRoom;

    await Project.findByIdAndDelete(projectId);
    console.log(`Project ${project.name} deleted from database`);

    setImmediate(() => {
      if (project.room && project.room.roomId) {
        const io = req.app.get('io');
        if (io) {
          const roomName = `room-${project.room.roomId}`;
          
          io.to(roomName).emit('project-deleted', {
            projectId,
            projectName: project.name,
            deletedBy: userId.toString(),
            deletedByUsername: req.user.username,
            redirectTo: {
              type: 'workspace',
              roomId: redirectRoomId
            },
            timestamp: new Date()
          });
          
          console.log(`📡 Broadcast sent for project deletion to ${roomName}`);
        }
      }
    });

    res.json({
      success: true,
      message: 'Project deleted successfully',
      data: {
        deletedFiles: deletedFilesResult.deletedCount,
        deletedMessages: deletedMessagesResult.deletedCount,
        projectName: project.name,
        redirectTo: {
          type: 'workspace',
          roomId: redirectRoomId,
          path: redirectRoomId ? `/editor/${redirectRoomId}` : '/'
        }
      }
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting project',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;