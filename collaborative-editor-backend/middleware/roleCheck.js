const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }
    
    next();
  };
};

const checkOwnership = (Model, idField = '_id') => {
  return async (req, res, next) => {
    try {
      const id = req.params[idField] || req.params.id;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID is required'
        });
      }
      
      const document = await Model.findById(id).lean();
      
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND'
        });
      }
      
      if (!document.owner) {
        return res.status(500).json({
          success: false,
          message: 'Resource does not have ownership information',
          code: 'NO_OWNERSHIP_INFO'
        });
      }

      const ownerId = document.owner._id || document.owner;
      if (ownerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to modify this resource',
          code: 'NOT_OWNER'
        });
      }
      
      req.document = document;
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid resource ID format',
          code: 'INVALID_ID'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error checking permissions',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

const checkProjectAccess = (requiredRole = 'viewer') => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      const Project = require('../models/Project');
      const project = await Project.findById(projectId)
        .select('owner collaborators isPublic')
        .lean();
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
      }
      
      if (project.owner.toString() === req.user._id.toString()) {
        req.userProjectRole = 'owner';
        req.project = project;
        return next();
      }
      
      if (project.isPublic && requiredRole === 'viewer') {
        req.userProjectRole = 'viewer';
        req.project = project;
        return next();
      }

      const collaborator = project.collaborators.find(
        c => c.user.toString() === req.user._id.toString()
      );
      
      if (!collaborator) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this project',
          code: 'NO_PROJECT_ACCESS'
        });
      }
      
      const roleHierarchy = {
        viewer: 0,
        editor: 1,
        admin: 2,
        owner: 3
      };
      
      const userRoleLevel = roleHierarchy[collaborator.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
      
      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. ${requiredRole} role required.`,
          code: 'INSUFFICIENT_PROJECT_PERMISSIONS',
          userRole: collaborator.role,
          requiredRole
        });
      }
      
      req.userProjectRole = collaborator.role;
      req.project = project;
      next();
      
    } catch (error) {
      console.error('Project access check error:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid project ID format',
          code: 'INVALID_PROJECT_ID'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error checking project access',
        code: 'PROJECT_ACCESS_CHECK_ERROR'
      });
    }
  };
};

const checkRoomAccess = () => {
  return async (req, res, next) => {
    try {
      const roomId = req.params.roomId || req.query.room;
      
      if (!roomId) {
        return res.status(400).json({
          success: false,
          message: 'Room ID is required'
        });
      }
      
      const Room = require('../models/SimplifiedRoom');
      const room = await Room.findOne({ roomId })
        .select('owner participants isPrivate')
        .lean();
      
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
          code: 'ROOM_NOT_FOUND'
        });
      }
      
      if (room.owner.toString() === req.user._id.toString()) {
        req.userRoomRole = 'owner';
        req.room = room;
        return next();
      }
      
      if (!room.isPrivate) {
        req.userRoomRole = 'participant';
        req.room = room;
        return next();
      }
      
      const isParticipant = room.participants.some(
        p => p.user.toString() === req.user._id.toString()
      );
      
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this room',
          code: 'NO_ROOM_ACCESS'
        });
      }
      
      req.userRoomRole = 'participant';
      req.room = room;
      next();
      
    } catch (error) {
      console.error('Room access check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking room access',
        code: 'ROOM_ACCESS_CHECK_ERROR'
      });
    }
  };
};

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  next();
};

const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required',
      code: 'SUPERADMIN_REQUIRED'
    });
  }
  
  next();
};

module.exports = {
  checkRole,
  checkOwnership,
  checkProjectAccess,
  checkRoomAccess,
  isAdmin,
  isSuperAdmin
};