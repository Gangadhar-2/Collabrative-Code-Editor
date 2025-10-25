const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: {
    type: String,
    index: true
  },
  project: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  channel: { 
    type: String,
    default: 'general'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderUsername: String, 
  senderAvatar: String,
  content: {
    type: String,
    required: true,
    maxlength: 5000 
  },
  type: {
    type: String,
    enum: ['text', 'system', 'code_execution'],
    default: 'text'
  },
  codeExecution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CodeExecution'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedForUsers: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

messageSchema.index({ room: 1, timestamp: -1 });
messageSchema.index({ project: 1, timestamp: -1 });
messageSchema.index({ sender: 1, timestamp: -1 });

messageSchema.methods.softDelete = function(userId) {
  if (!this.deletedForUsers.includes(userId)) {
    this.deletedForUsers.push(userId);
  }
  return this.save();
};

messageSchema.pre('save', async function(next) {
  if (this.isNew && this.sender) {
    try {
      const User = mongoose.model('User');
      const user = await User.findById(this.sender).select('username profilePicture');
      if (user) {
        this.senderUsername = user.username;
        this.senderAvatar = user.profilePicture;
      }
    } catch (error) {
      console.error('Error caching sender info:', error);
    }
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);