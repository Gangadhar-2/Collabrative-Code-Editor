const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    default: 'javascript',
    enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'json', 'markdown']
  },
  language: {
    type: String,
    default: 'javascript',
    enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'json', 'markdown']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  room: {
    type: String,
    index: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    default: null
  },
  isDirectory: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

fileSchema.index({ project: 1, name: 1 });
fileSchema.index({ room: 1, name: 1 });
fileSchema.index({ project: 1, isDeleted: 1 });
fileSchema.index({ room: 1, createdAt: -1 });

fileSchema.virtual('extension').get(function() {
  const parts = this.name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : null;
});

module.exports = mongoose.model('File', fileSchema);