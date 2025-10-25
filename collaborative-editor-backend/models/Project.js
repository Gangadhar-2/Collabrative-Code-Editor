const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectType: {
    type: String,
    enum: ['web', 'backend', 'desktop', 'mobile'],
    default: 'web'
  },
  primaryLanguage: {
    type: String,
    enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c'],
    default: 'javascript'
  },
  framework: {
    type: String,
    default: 'none'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'private'
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    joinedAt: Date,
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  room: {
    roomId: String,
    maxUsers: Number
  },
  editorSettings: {
    theme: { type: String, default: 'vs-dark' },
    fontSize: { type: Number, default: 14 },
    tabSize: { type: Number, default: 2 }
  },
  buildConfig: Object,
  dependencies: Object,
  stats: {
    views: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    lastAccessed: Date
  },
  activityLog: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: String,
    description: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Methods
projectSchema.methods.hasAccess = function(userId, requiredRole = 'viewer') {
  if (this.owner.toString() === userId.toString()) return true;
  if (this.isPublic && requiredRole === 'viewer') return true;
  
  const collaborator = this.collaborators.find(c =>
    c.user.toString() === userId.toString()
  );
  
  if (!collaborator) return false;
  
  const roles = ['viewer', 'editor', 'admin'];
  const userRoleIndex = roles.indexOf(collaborator.role);
  const requiredRoleIndex = roles.indexOf(requiredRole);
  
  return userRoleIndex >= requiredRoleIndex;
};

projectSchema.methods.logActivity = function(userId, action, description) {
  this.activityLog.push({
    user: userId,
    action,
    description,
    timestamp: new Date()
  });
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);