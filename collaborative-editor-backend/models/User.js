const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const preferencesSchema = new mongoose.Schema({
  editor: {
    theme: { type: String, default: 'vs-dark' },
    fontSize: { type: Number, default: 14, min: 10, max: 24 },
    tabSize: { type: Number, default: 2, min: 1, max: 8 },
    wordWrap: { type: String, default: 'off', enum: ['off', 'on', 'bounded'] },
    lineNumbers: { type: Boolean, default: true },
    minimap: { type: Boolean, default: true },
    autoSave: { type: Boolean, default: true },
    formatOnSave: { type: Boolean, default: false },
    bracketPairColorization: { type: Boolean, default: true },
    suggestOnTriggerCharacters: { type: Boolean, default: true }
  },
  terminal: {
    fontSize: { type: Number, default: 13 },
    fontFamily: { type: String, default: 'monospace' },
    cursorStyle: { type: String, default: 'block', enum: ['block', 'underline', 'line'] }
  },
  collaboration: {
    showCursors: { type: Boolean, default: true },
    showSelections: { type: Boolean, default: true },
    playSounds: { type: Boolean, default: false },
    showNotifications: { type: Boolean, default: true }
  },
  accessibility: {
    highContrast: { type: Boolean, default: false },
    screenReaderOptimized: { type: Boolean, default: false },
    reducedMotion: { type: Boolean, default: false }
  }
});

const notificationSettingsSchema = new mongoose.Schema({
  email: {
    projectInvites: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true },
    collaboratorJoined: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: false }
  },
  push: {
    enabled: { type: Boolean, default: false },
    token: String,
    deviceType: String
  },
  inApp: {
    enabled: { type: Boolean, default: true }
  }
})

const roomAssociationSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['owner', 'participant'],
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  accessCode: String
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must be less than 30 characters'],
    match: [/^[a-z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      return this.provider === 'local';
    },
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  fullName: {
    type: String,
    maxlength: [100, 'Name must be less than 100 characters']
  },
  displayName: {
    type: String,
    maxlength: [50, 'Display name must be less than 50 characters']
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio must be less than 500 characters']
  },
  profilePicture: {
    type: String,
    default: null
  },
  coverImage: String,
  location: {
    city: String,
    country: String,
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  website: String,
  company: String,
  jobTitle: String,

  provider: {
    type: String,
    enum: ['local', 'google', 'github', 'microsoft'],
    default: 'local'
  },
  googleId: {
    type: String,
    sparse: true
  },
  githubId: {
    type: String,
    sparse: true
  },
  microsoftId: {
    type: String,
    sparse: true
  },
  
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  backupCodes: {
    type: [String],
    select: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lastFailedLogin: Date,
  accountLockedUntil: Date,
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'deleted', 'locked'],
    default: 'active'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date,
  lastActivity: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  
  currentRoom: {
    type: String,
    default: null
  },
  rooms: [roomAssociationSchema],
  defaultWorkspaceRoomId: {
    type: String,
    default: null,
    index: true
  },
  workspaceInitialized: {
    type: Boolean,
    default: false
  },
  
  skills: [{
    name: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert']
    },
    endorsed: { type: Number, default: 0 }
  }],
  languages: [String],
  frameworks: [String],
  tools: [String],
  
  projects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  ownedProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  collaboratingProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  favoriteProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  recentProjects: [{
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    accessedAt: Date
  }],
  
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'superadmin'],
    default: 'user'
  },
  permissions: {
    canCreateProjects: { type: Boolean, default: true },
    canJoinRooms: { type: Boolean, default: true },
    canExecuteCode: { type: Boolean, default: true },
    maxProjects: { type: Number, default: 10 },
    maxCollaborators: { type: Number, default: 5 },
    maxFileSize: { type: Number, default: 10485760 },
    maxStorageSize: { type: Number, default: 1073741824 }
  },
  subscription: {
    type: {
      type: String,
      enum: ['free', 'pro', 'team', 'enterprise'],
      default: 'free'
    },
    validUntil: Date,
    autoRenew: { type: Boolean, default: false }
  },
  
  preferences: preferencesSchema,
  notificationSettings: notificationSettingsSchema,
  
  stats: {
    projectsCreated: { type: Number, default: 0 },
    totalContributions: { type: Number, default: 0 },
    totalCodeExecutions: { type: Number, default: 0 },
    totalLinesWritten: { type: Number, default: 0 },
    totalCollaborations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    totalFilesCreated: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },
    helpfulVotes: { type: Number, default: 0 },
    roomsCreated: { type: Number, default: 0 },
    roomsJoined: { type: Number, default: 0 }
  },
  achievements: [{
    name: String,
    description: String,
    icon: String,
    earnedAt: Date
  }],
  
  apiKeys: [{
    key: String,
    name: String,
    permissions: [String],
    createdAt: Date,
    lastUsed: Date,
    isActive: { type: Boolean, default: true }
  }],
  integrations: {
    github: {
      connected: { type: Boolean, default: false },
      username: String,
      accessToken: { type: String, select: false }
    },
    gitlab: {
      connected: { type: Boolean, default: false },
      username: String,
      accessToken: { type: String, select: false }
    }
  },
  
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'private', 'connections'],
      default: 'public'
    },
    showEmail: { type: Boolean, default: false },
    showActivity: { type: Boolean, default: true },
    showProjects: { type: Boolean, default: true },
    allowMessages: { type: Boolean, default: true },
    allowInvites: { type: Boolean, default: true }
  },
  
  metadata: {
    referrer: String,
    signupSource: String,
    ipAddress: String,
    userAgent: String,
    customData: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'rooms.roomId': 1 });
userSchema.index({ currentRoom: 1 });
userSchema.index({ defaultWorkspaceRoomId: 1 });
userSchema.index({ owner: 1, createdAt: -1 });
userSchema.index({ 'collaborators.user': 1 });
userSchema.index({ createdAt: -1 });

userSchema.virtual('followerCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

userSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

userSchema.virtual('projectCount').get(function() {
  return this.projects ? this.projects.length : 0;
});

userSchema.virtual('isVerified').get(function() {
  return this.emailVerified && this.status === 'active';
});

userSchema.virtual('isPremium').get(function() {
  return ['pro', 'team', 'enterprise'].includes(this.subscription.type) &&
         this.subscription.validUntil > new Date();
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      console.log('Password hashed for user:', this.username);
    } catch (error) {
      return next(error);
    }
  }
  
  if (!this.profilePicture && this.email) {
    const hash = crypto.createHash('md5').update(this.email).digest('hex');
    this.profilePicture = `https://gravatar.com/avatar/${hash}?d=identicon`;
  }
  
  if (!this.displayName) {
    this.displayName = this.fullName || this.username;
  }
  
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const user = await this.constructor.findById(this._id).select('+password');
    if (!user || !user.password) return false;
    
    const isMatch = await bcrypt.compare(candidatePassword, user.password);
    console.log('Password comparison result:', isMatch ? 'Match' : 'No match');
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

userSchema.methods.initializeWorkspace = async function() {
  if (this.workspaceInitialized && this.defaultWorkspaceRoomId) {
    return this.defaultWorkspaceRoomId;
  }

  let workspaceRoomId;
  let attempts = 0;
  const maxAttempts = 50;
  
  const Room = mongoose.model('SimplifiedRoom');
  
  do {
    workspaceRoomId = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    if (!/^\d{8}$/.test(workspaceRoomId)) {
      console.log('Generated non-numeric ID, retrying...');
      continue;
    }
    
    const existingRoom = await Room.findOne({ roomId: workspaceRoomId });
    if (!existingRoom) {
      break; 
    }
    
    attempts++;
    console.log(`Numeric Room ID ${workspaceRoomId} already exists, trying again (attempt ${attempts})`);
  } while (attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    const timestamp = Date.now().toString();
    workspaceRoomId = timestamp.slice(-8).padStart(8, '0');
    console.warn(`Used timestamp fallback Room ID: ${workspaceRoomId}`);
  }
  
  if (!/^\d{8}$/.test(workspaceRoomId)) {
    workspaceRoomId = Math.floor(10000000 + Math.random() * 90000000).toString();
    console.error('Emergency numeric fallback used:', workspaceRoomId);
  }
  
  this.defaultWorkspaceRoomId = workspaceRoomId;
  this.workspaceInitialized = true;
  
  this.addRoom(workspaceRoomId, 'owner', null, true);
  
  await this.save();
  console.log(`✅ Workspace initialized with NUMERIC-ONLY Room ID: ${workspaceRoomId}`);
  return workspaceRoomId;
};

userSchema.methods.getDefaultWorkspace = function() {
  return this.defaultWorkspaceRoomId;
};

userSchema.methods.hasWorkspace = function() {
  return this.workspaceInitialized && this.defaultWorkspaceRoomId;
};

userSchema.methods.addRoom = function(roomId, role = 'participant', accessCode = null, isDefault = false) {
  const existingRoom = this.rooms.find(room => room.roomId === roomId);
  if (!existingRoom) {
    this.rooms.push({
      roomId,
      role,
      joinedAt: new Date(),
      lastAccessed: new Date(),
      accessCode,
      isDefault
    });
    
    if (role === 'owner') {
      this.stats.roomsCreated += 1;
    } else {
      this.stats.roomsJoined += 1;
    }
  }
  return this;
};

userSchema.methods.removeRoom = function(roomId) {
  if (roomId === this.defaultWorkspaceRoomId) {
    return this;
  }
  
  this.rooms = this.rooms.filter(room => room.roomId !== roomId);
  if (this.currentRoom === roomId) {
    this.currentRoom = null;
  }
  return this;
};

userSchema.methods.setCurrentRoom = function(roomId) {
  const room = this.rooms.find(r => r.roomId === roomId);
  if (room) {
    this.currentRoom = roomId;
    room.lastAccessed = new Date();
  }
  return this;
};

userSchema.methods.getUserRooms = function() {
  return this.rooms.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return b.lastAccessed - a.lastAccessed;
  });
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.twoFactorSecret;
  delete user.backupCodes;
  delete user.emailVerificationToken;
  delete user.passwordResetToken;
  delete user.apiKeys;
  return user;
};

userSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'admin' || this.role === 'superadmin') return true;
  return this.permissions[permission] !== false;
};

userSchema.methods.canCreateProject = function() {
  if (this.role === 'admin' || this.role === 'superadmin') return true;
  return this.projects.length < this.permissions.maxProjects;
};

userSchema.methods.updateActivity = async function() {
  this.lastActivity = new Date();
  this.isOnline = true;
  return this.save();
};

userSchema.statics.findByCredentials = async function(emailOrUsername) {
  const query = emailOrUsername.includes('@')
    ? { email: emailOrUsername.toLowerCase() }
    : { username: emailOrUsername.toLowerCase() };
  
  return this.findOne(query).select('+password');
};

const User = mongoose.model('User', userSchema);
module.exports = User;