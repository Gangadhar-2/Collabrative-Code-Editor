const express = require('express');
const router = express.Router();
const File = require('../models/File');
const Project = require('../models/Project');
const Room = require('../models/SimplifiedRoom');

async function checkRoomAccess(roomId, userId) {
  const room = await Room.findOne({ roomId }).lean();
  if (!room) return false;
  
  const isOwner = room.owner.toString() === userId.toString();
  const isParticipant = room.participants.some(p => {
    const participantId = typeof p.user === 'object' ? p.user.toString() : p.user.toString();
    return participantId === userId.toString();
  });
  
  return isOwner || isParticipant;
}

async function checkProjectAccess(projectId, userId) {
  const project = await Project.findById(projectId).lean();
  if (!project) return false;
  
  const isOwner = project.owner.toString() === userId.toString();
  const isCollaborator = project.collaborators.some(c => {
    const collabId = typeof c.user === 'object' ? c.user.toString() : c.user.toString();
    return collabId === userId.toString();
  });
  const isPublic = project.isPublic;
  
  return isOwner || isCollaborator || isPublic;
}

router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`Getting files for project: ${projectId}`);
    
    const hasAccess = await checkProjectAccess(projectId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const files = await File.find({
      project: projectId,
      isDeleted: false
    })
    .sort({ isDirectory: -1, name: 1 })
    .populate('createdBy', 'username')
    .populate('lastModifiedBy', 'username')
    .lean();
    
    console.log(`Found ${files.length} files for project ${projectId}`);
    
    res.json({
      success: true,
      data: {
        files,
        projectId
      }
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project files'
    });
  }
});

router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log(`Getting files for room: ${roomId}`);
    
    const hasAccess = await checkRoomAccess(roomId, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    const files = room.files.map(file => ({
      _id: file.fileId,
      id: file.fileId,
      name: file.name,
      content: file.content,
      language: file.language,
      fileType: file.language,
      isDirectory: file.isDirectory,
      parent: file.parent,
      createdAt: file.createdAt,
      lastModified: file.lastModified,
      lastModifiedBy: file.lastModifiedBy,
      size: file.size
    }));
    
    console.log(`Found ${files.length} files for room ${roomId}`);
    
    res.json({
      success: true,
      data: {
        files,
        roomId
      }
    });
  } catch (error) {
    console.error('Get room files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching room files'
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, content = '', fileType = 'javascript', project, room, isDirectory = false, parent = null } = req.body;
    
    console.log('Creating file:', { name, fileType, project, room, isDirectory, userId: req.user._id, username: req.user.username });
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'File name is required'
      });
    }

    if (!room && !project) {
      return res.status(400).json({
        success: false,
        message: 'Either project or room must be specified'
      });
    }

    if (room) {
      const hasAccess = await checkRoomAccess(room, req.user._id);
      if (!hasAccess) {
        console.error(`❌ Access denied: User ${req.user.username} cannot create files in room ${room}`);
        return res.status(403).json({
          success: false,
          message: 'Access denied - You must be a room participant to create files'
        });
      }

      const roomDoc = await Room.findOne({ roomId: room });
      if (!roomDoc) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      console.log(`✅ Permission granted for ${req.user.username} to create file in room ${room}`);

      await roomDoc.addFile(name, content, fileType, req.user._id, isDirectory, parent);
      
      const newFile = roomDoc.files[roomDoc.files.length - 1];
      
      console.log(`✅ File created in workspace: ${name} in room ${room} by ${req.user.username}`);
      
      const fileData = {
        _id: newFile.fileId,
        id: newFile.fileId,
        name: newFile.name,
        content: newFile.content,
        fileType: newFile.language,
        language: newFile.language,
        isDirectory: newFile.isDirectory,
        createdAt: newFile.createdAt,
        lastModified: newFile.lastModified,
        createdBy: { _id: req.user._id, username: req.user.username },
        room: room
      };
      
      const io = req.app.get('io');
      if (io) {
        io.to(`room-${room}`).emit('file-created', {
          file: fileData,
          user: {
            id: req.user._id,
            username: req.user.username
          },
          roomId: room,
          timestamp: new Date()
        });
        console.log(`📡 Broadcasted file-created event to room-${room}`);
      }
      
      res.status(201).json({
        success: true,
        message: `${isDirectory ? 'Folder' : 'File'} created successfully`,
        data: { 
          file: fileData
        }
      });
      return;
    }

    if (project) {
      const hasAccess = await checkProjectAccess(project, req.user._id);
      if (!hasAccess) {
        console.error(`❌ Access denied: User ${req.user.username} cannot create files in project ${project}`);
        return res.status(403).json({
          success: false,
          message: 'Access denied - You must have access to this project'
        });
      }

      const projectDoc = await Project.findById(project);
      if (!projectDoc) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      console.log(`✅ Permission granted for ${req.user.username} to create file in project ${project}`);
      
      const existingFile = await File.findOne({
        project,
        name,
        parent,
        isDeleted: false
      });
      
      if (existingFile) {
        return res.status(409).json({
          success: false,
          message: `A ${isDirectory ? 'folder' : 'file'} with this name already exists`
        });
      }
      
      const basePath = parent ? await getParentPath(parent) : '';
      const filePath = basePath ? `${basePath}/${name}` : `/${name}`;
      
      const file = new File({
        name,
        content: isDirectory ? '' : content,
        fileType: isDirectory ? undefined : fileType,
        language: isDirectory ? undefined : fileType,
        project,
        parent,
        isDirectory,
        path: filePath,
        createdBy: req.user._id,
        lastModifiedBy: req.user._id,
        lastModified: new Date(),
        isActive: true
      });
      
      const savedFile = await file.save();
      await savedFile.populate('createdBy', 'username');
      
      console.log(`✅ File created in project: ${name} in project ${project} by ${req.user.username}`);
      
      const io = req.app.get('io');
      if (io && projectDoc.room?.roomId) {
        io.to(`room-${projectDoc.room.roomId}`).emit('file-created', {
          file: savedFile,
          user: {
            id: req.user._id,
            username: req.user.username
          },
          projectId: project,
          timestamp: new Date()
        });
        console.log(`📡 Broadcasted file-created event to project room`);
      }
      
      res.status(201).json({
        success: true,
        message: `${isDirectory ? 'Folder' : 'File'} created successfully`,
        data: { 
          file: savedFile
        }
      });
      return;
    }
    
  } catch (error) {
    console.error('Create file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

async function getParentPath(parentId) {
  try {
    const parent = await File.findById(parentId).select('path');
    return parent ? parent.path : '';
  } catch (error) {
    return '';
  }
}

router.put('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const { name, content, fileType, room } = req.body;
    
    console.log(`Updating file: ${fileId}`, { name, hasContent: !!content, fileType, room, user: req.user.username });
    
    if (room) {
      const hasAccess = await checkRoomAccess(room, req.user._id);
      if (!hasAccess) {
        console.error(`Access denied for user ${req.user.username} to room ${room}`);
        return res.status(403).json({
          success: false,
          message: 'Access denied - you must be a room participant'
        });
      }

      const roomDoc = await Room.findOne({ roomId: room });
      if (!roomDoc) {
        console.error(`Room not found: ${room}`);
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      const file = roomDoc.files.find(f => f.fileId === fileId);
      if (!file) {
        console.error(`File ${fileId} not found in room ${room}`);
        return res.status(404).json({
          success: false,
          message: 'File not found in room'
        });
      }

      if (name !== undefined) file.name = name;
      if (content !== undefined) {
        file.content = content;
        file.size = Buffer.byteLength(content, 'utf8');
      }
      if (fileType !== undefined) file.language = fileType;
      
      file.lastModified = new Date();
      file.lastModifiedBy = req.user._id;
      
      await roomDoc.save();
      
      console.log(`✅ File ${file.name} updated successfully in room ${room} by ${req.user.username}`);
      
      res.json({
        success: true,
        message: 'File updated successfully',
        data: { 
          file: {
            _id: file.fileId,
            id: file.fileId,
            name: file.name,
            content: file.content,
            fileType: file.language,
            language: file.language,
            lastModified: file.lastModified,
            lastModifiedBy: { _id: req.user._id, username: req.user.username }
          }
        }
      });
      return;
    }

    const file = await File.findById(fileId).populate('project', 'owner collaborators isPublic');
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (!file.project) {
      return res.status(400).json({
        success: false,
        message: 'File has no associated project'
      });
    }

    const hasAccess = await checkProjectAccess(file.project._id, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you must have access to this project'
      });
    }
    
    if (name !== undefined) file.name = name;
    if (content !== undefined) file.content = content;
    if (fileType !== undefined) {
      file.fileType = fileType;
      file.language = fileType;
    }
    
    file.lastModifiedBy = req.user._id;
    file.lastModified = new Date();
    
    const updatedFile = await file.save();
    await updatedFile.populate('lastModifiedBy', 'username');
    
    console.log(`✅ Project file ${file.name} updated successfully`);
    
    res.json({
      success: true,
      message: 'File updated successfully',
      data: { file: updatedFile }
    });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const { room } = req.query;
    
    console.log(`Deleting file: ${fileId}, room: ${room}`);
    
    if (room) {
      const hasAccess = await checkRoomAccess(room, req.user._id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const roomDoc = await Room.findOne({ roomId: room });
      if (!roomDoc) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      const fileIndex = roomDoc.files.findIndex(f => f.fileId === fileId);
      if (fileIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const file = roomDoc.files[fileIndex];
      const fileName = file.name;
      roomDoc.files.splice(fileIndex, 1);
      
      if (file.isDirectory) {
        roomDoc.files = roomDoc.files.filter(f => f.parent !== fileId);
      }
      
      await roomDoc.save();
      
      console.log(`File ${fileName} deleted from room ${room}`);
      
      const io = req.app.get('io');
      if (io) {
        io.to(`room-${room}`).emit('file-deleted', {
          fileId,
          fileName,
          user: {
            id: req.user._id,
            username: req.user.username
          },
          roomId: room,
          timestamp: new Date()
        });
        console.log(`📡 Broadcasted file-deleted event to room-${room}`);
      }
      
      res.json({
        success: true,
        message: `${file.isDirectory ? 'Folder' : 'File'} deleted successfully`
      });
      return;
    }

    const file = await File.findById(fileId).populate('project', 'owner collaborators isPublic room');
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const hasAccess = await checkProjectAccess(file.project._id, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const fileName = file.name;
    const projectId = file.project._id;
    
    await File.findByIdAndDelete(fileId);
    
    if (file.isDirectory) {
      await File.deleteMany({ parent: fileId });
    }
    
    console.log(`File ${fileName} deleted from database`);

    const io = req.app.get('io');
    if (io && file.project.room?.roomId) {
      io.to(`room-${file.project.room.roomId}`).emit('file-deleted', {
        fileId,
        fileName,
        user: {
          id: req.user._id,
          username: req.user.username
        },
        projectId,
        timestamp: new Date()
      });
      console.log(`📡 Broadcasted file-deleted event to project room`);
    }
    
    res.json({
      success: true,
      message: `${file.isDirectory ? 'Folder' : 'File'} deleted successfully`
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file'
    });
  }
});

router.put('/:id/rename', async (req, res) => {
  try {
    const fileId = req.params.id;
    const { newName, room } = req.body;
    
    if (!newName || !newName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'New name is required'
      });
    }
    
    console.log(`Renaming file: ${fileId} to ${newName}`);
    
    if (room) {
      const hasAccess = await checkRoomAccess(room, req.user._id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const roomDoc = await Room.findOne({ roomId: room });
      if (!roomDoc) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      const file = roomDoc.files.find(f => f.fileId === fileId);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const existingFile = roomDoc.files.find(f => f.name === newName.trim() && f.parent === file.parent && f.fileId !== fileId);
      if (existingFile) {
        return res.status(409).json({
          success: false,
          message: 'A file with this name already exists'
        });
      }

      const oldName = file.name;
      file.name = newName.trim();
      file.lastModified = new Date();
      file.lastModifiedBy = req.user._id;
      
      await roomDoc.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`room-${room}`).emit('file-renamed', {
          fileId,
          oldName,
          newName: newName.trim(),
          user: {
            id: req.user._id,
            username: req.user.username
          },
          roomId: room,
          timestamp: new Date()
        });
        console.log(`📡 Broadcasted file-renamed event to room-${room}`);
      }
      
      res.json({
        success: true,
        message: 'File renamed successfully',
        data: { 
          file: {
            _id: file.fileId,
            id: file.fileId,
            name: file.name,
            lastModified: file.lastModified
          }
        }
      });
      return;
    }

    const file = await File.findById(fileId).populate('project', 'owner collaborators isPublic room');
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const hasAccess = await checkProjectAccess(file.project._id, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const existingFile = await File.findOne({
      project: file.project._id,
      parent: file.parent,
      name: newName.trim(),
      isDeleted: false,
      _id: { $ne: fileId }
    });
    
    if (existingFile) {
      return res.status(409).json({
        success: false,
        message: 'A file with this name already exists'
      });
    }
    
    const oldName = file.name;
    file.name = newName.trim();
    file.lastModifiedBy = req.user._id;
    file.lastModified = new Date();
    
    const updatedFile = await file.save();
    
    const io = req.app.get('io');
    if (io && file.project.room?.roomId) {
      io.to(`room-${file.project.room.roomId}`).emit('file-renamed', {
        fileId,
        oldName,
        newName: newName.trim(),
        user: {
          id: req.user._id,
          username: req.user.username
        },
        projectId: file.project._id,
        timestamp: new Date()
      });
      console.log(`📡 Broadcasted file-renamed event to project room`);
    }
    
    res.json({
      success: true,
      message: 'File renamed successfully',
      data: { file: updatedFile }
    });
  } catch (error) {
    console.error('Rename file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error renaming file'
    });
  }
})

router.get('/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const { room } = req.query;
    
    if (room) {
      const hasAccess = await checkRoomAccess(room, req.user._id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const roomDoc = await Room.findOne({ roomId: room });
      if (!roomDoc) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      const file = roomDoc.files.find(f => f.fileId === fileId);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      res.json({
        success: true,
        data: { 
          file: {
            _id: file.fileId,
            id: file.fileId,
            name: file.name,
            content: file.content,
            fileType: file.language,
            language: file.language,
            isDirectory: file.isDirectory,
            createdAt: file.createdAt,
            lastModified: file.lastModified
          }
        }
      });
      return;
    }

    const file = await File.findById(fileId)
      .populate('project', 'owner collaborators isPublic')
      .populate('createdBy', 'username')
      .populate('lastModifiedBy', 'username');
    
    if (!file || file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const hasAccess = await checkProjectAccess(file.project._id, req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { file }
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching file'
    });
  }
});

module.exports = router;