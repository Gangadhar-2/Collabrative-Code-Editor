
const mongoose = require('mongoose');
const crypto = require('crypto');

const activeParticipantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  socketId: String,
  username: String,
  displayName: String,
  avatar: String,
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  cursorPosition: {
    line: Number,
    column: Number
  },
  selection: {
    startLine: Number,
    startColumn: Number,
    endLine: Number,
    endColumn: Number
  },
  currentFile: String,
  color: String
});

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
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
  
  isWorkspace: {
    type: Boolean,
    default: false
  },
  isPersistent: {
    type: Boolean,
    default: false
  },
  workspaceOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  
  isPrivate: {
    type: Boolean,
    default: false
  },
  accessCode: String,
  
  activeParticipants: [activeParticipantSchema],
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    lastJoined: Date,
    role: {
      type: String,
      enum: ['owner', 'admin', 'collaborator', 'viewer'],
      default: 'collaborator'
    }
  }],
  
  files: [{
    fileId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    content: {
      type: String,
      default: ''
    },
    language: {
      type: String,
      default: 'javascript'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDirectory: {
      type: Boolean,
      default: false
    },
    parent: String,
    size: {
      type: Number,
      default: 0
    }
  }],
  
  messages: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    avatar: String,
    text: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['text', 'system', 'code', 'execution', 'file_share'],
      default: 'text'
    },
    codeExecution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodeExecution'
    },
    fileReference: {
      fileId: String,
      fileName: String
    }
  }],
  
  executionSettings: {
    defaultLanguage: {
      type: String,
      enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'ruby', 'go', 'rust', 'php'],
      default: 'javascript'
    },
    defaultVersion: String,
    timeLimit: {
      type: Number,
      default: 10000
    },
    memoryLimit: {
      type: Number, 
      default: 512
    },
    allowedLanguages: [{
      type: String,
      enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'ruby', 'go', 'rust', 'php']
    }]
  },
  
  editorSettings: {
    theme: { type: String, default: 'vs-dark' },
    fontSize: { type: Number, default: 14 },
    tabSize: { type: Number, default: 2 },
    lineNumbers: { type: Boolean, default: true },
    wordWrap: { type: String, default: 'off' },
    enableLiveShare: { type: Boolean, default: true },
    showMinimap: { type: Boolean, default: true },
    enableAutocomplete: { type: Boolean, default: true }
  },
  
  roomSettings: {
    maxParticipants: {
      type: Number,
      default: 10
    },
    allowAnonymous: {
      type: Boolean,
      default: false
    },
    autoSaveInterval: {
      type: Number,
      default: 30000
    },
    chatEnabled: {
      type: Boolean,
      default: true
    },
    codeExecutionEnabled: {
      type: Boolean,
      default: true
    }
  },

  stats: {
    totalJoins: {
      type: Number,
      default: 0
    },
    executions: {
      type: Number,
      default: 0
    },
    messages: {
      type: Number,
      default: 0
    },
    filesCreated: {
      type: Number,
      default: 0
    },
    collaborativeHours: {
      type: Number,
      default: 0
    },
    uniqueVisitors: {
      type: Number,
      default: 0
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: Date,
  lastBackup: Date,
  autoBackup: {
    type: Boolean,
    default: false
  },
  backupInterval: {
    type: Number,
    default: 86400000
  }
}, {
  timestamps: true
});

roomSchema.index({ owner: 1 });
roomSchema.index({ 'participants.user': 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ lastActivity: -1 });
roomSchema.index({ isWorkspace: 1, owner: 1 });
roomSchema.index({ isPersistent: 1 });
roomSchema.index({ isActive: 1, isPrivate: 1 });

roomSchema.virtual('participantCount').get(function() {
  return this.activeParticipants.length;
});

roomSchema.virtual('fileCount').get(function() {
  return this.files.filter(f => !f.isDirectory).length;
});

roomSchema.virtual('totalFileSize').get(function() {
  return this.files.reduce((total, file) => total + (file.size || 0), 0);
});

roomSchema.methods.addParticipant = async function(user, socketId) {
  const existingIndex = this.activeParticipants.findIndex(
    p => p.user.toString() === user._id.toString()
  );
  
  if (existingIndex >= 0) {
    this.activeParticipants[existingIndex].socketId = socketId;
    this.activeParticipants[existingIndex].lastActivity = new Date();
  } else {
    this.activeParticipants.push({
      user: user._id,
      socketId,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.profilePicture,
      color: getRandomColor(),
      joinedAt: new Date(),
      lastActivity: new Date()
    });
    
    const participantExists = this.participants.some(
      p => p.user.toString() === user._id.toString()
    );
    
    if (!participantExists) {
      this.participants.push({
        user: user._id,
        joinedAt: new Date(),
        lastJoined: new Date(),
        role: user._id.toString() === this.owner.toString() ? 'owner' : 'collaborator'
      });
      this.stats.uniqueVisitors += 1;
    } else {
      const participant = this.participants.find(
        p => p.user.toString() === user._id.toString()
      );
      if (participant) {
        participant.lastJoined = new Date();
      }
    }
    
    this.stats.totalJoins += 1;
  }
  
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.removeParticipant = async function(userId) {
  this.activeParticipants = this.activeParticipants.filter(
    p => p.user.toString() !== userId.toString()
  );
  
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.addMessage = async function(user, text, type = 'text', codeExecutionId = null, fileReference = null) {
  const message = {
    user: user._id,
    username: user.username,
    avatar: user.profilePicture,
    text,
    timestamp: new Date(),
    type
  };
  
  if (codeExecutionId) {
    message.codeExecution = codeExecutionId;
  }
  
  if (fileReference) {
    message.fileReference = fileReference;
  }
  
  this.messages.push(message);
  this.stats.messages += 1;
  
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.addFile = async function(name, content = '', language = 'javascript', userId, isDirectory = false, parent = null) {
  const fileId = crypto.randomBytes(16).toString('hex');
  const fileSize = Buffer.byteLength(content, 'utf8');
  
  this.files.push({
    fileId,
    name,
    content,
    language,
    isDirectory,
    parent,
    size: fileSize,
    createdAt: new Date(),
    lastModified: new Date(),
    lastModifiedBy: userId
  });
  
  this.stats.filesCreated += 1;
  this.lastActivity = new Date();
  return this.save();
};

roomSchema.methods.updateFile = async function(fileId, content, userId) {
  const file = this.files.find(f => f.fileId === fileId);
  
  if (file && !file.isDirectory) {
    file.content = content;
    file.size = Buffer.byteLength(content, 'utf8');
    file.lastModified = new Date();
    file.lastModifiedBy = userId;
    
    this.lastActivity = new Date();
    return this.save();
  }
  
  return null;
};

roomSchema.methods.deleteFile = async function(fileId) {
  const initialLength = this.files.length;
  this.files = this.files.filter(f => f.fileId !== fileId);
  
  if (this.files.length < initialLength) {
    this.lastActivity = new Date();
    return this.save();
  }
  
  return null;
};

roomSchema.methods.getFileById = function(fileId) {
  return this.files.find(f => f.fileId === fileId) || null;
};

roomSchema.methods.isOwner = function(userId) {
  return this.owner.toString() === userId.toString();
};

roomSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user.toString() === userId.toString()) ||
         this.owner.toString() === userId.toString();
};

roomSchema.methods.canEdit = function(userId) {
  if (this.isOwner(userId)) return true;
  
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  return participant && ['admin', 'collaborator'].includes(participant.role);
};

roomSchema.statics.findByRoomId = function(roomId) {
  return this.findOne({ roomId });
};

roomSchema.statics.findActiveRooms = function(limit = 10) {
  return this.find({
    isActive: true,
    isPrivate: false,
    'activeParticipants.0': { $exists: true }
  })
  .sort({ lastActivity: -1 })
  .limit(limit)
  .select('roomId name description owner activeParticipants isWorkspace isPersistent');
};

roomSchema.statics.findUserRooms = function(userId) {
  return this.find({
    $or: [
      { owner: userId },
      { 'participants.user': userId }
    ]
  })
  .sort({ isWorkspace: -1, lastActivity: -1 })
  .select('roomId name description owner isWorkspace isPersistent createdAt lastActivity');
};

roomSchema.statics.findUserWorkspace = function(userId) {
  return this.findOne({
    owner: userId,
    isWorkspace: true
  });
};

roomSchema.statics.cleanupInactiveRooms = async function(hours = 72) {
  const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  return this.updateMany(
    { 
      lastActivity: { $lt: cutoff },
      isActive: true,
      isPersistent: false,
      isWorkspace: false
    },
    { 
      isActive: false
    }
  );
};

roomSchema.pre('save', async function(next) {
  if (this.isNew && !this.roomId) {
    let roomId;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
      roomId = Math.floor(10000000 + Math.random() * 90000000).toString();
      
      if (!/^\d{8}$/.test(roomId)) {
        console.log('Generated non-numeric ID, retrying...');
        continue;
      }
      
      const existingRoom = await this.constructor.findOne({ roomId });
      if (!existingRoom) {
        this.roomId = roomId;
        break;
      }
      
      attempts++;
      console.log(`Numeric Room ID ${roomId} exists, retrying (attempt ${attempts})`);
    } while (attempts < maxAttempts);
    
    if (!this.roomId) {
      const timestamp = Date.now().toString();
      this.roomId = timestamp.slice(-8).padStart(8, '0');
      console.warn(`Used timestamp fallback Room ID: ${this.roomId}`);
    }
    
    if (!/^\d{8}$/.test(this.roomId)) {
      // Emergency fallback
      this.roomId = Math.floor(10000000 + Math.random() * 90000000).toString();
      console.error('Emergency numeric fallback used:', this.roomId);
    }
    
    console.log(`✅ Generated NUMERIC-ONLY Room ID: ${this.roomId}`);
  }
  
  if (this.isPrivate && !this.accessCode) {
    this.accessCode = Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  if (this.isWorkspace && !this.workspaceOwner) {
    this.workspaceOwner = this.owner;
  }
  
  if (this.isWorkspace) {
    this.isPersistent = true;
  }
  
  next();
});

function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#556270', '#C44D58', '#FFA630',
    '#77DD77', '#779ECB', '#AEC6CF', '#FFD1DC', '#836953',
    '#CFCFC4', '#77A1D3', '#6C88C4', '#41658A', '#414073',
    '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

const Room = mongoose.model('SimplifiedRoom', roomSchema);
module.exports = Room;