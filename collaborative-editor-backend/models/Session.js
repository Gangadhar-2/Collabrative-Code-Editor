
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
    required: true
  },
  accessTokenExpiry: {
    type: Date,
    required: true
  },
  refreshTokenExpiry: {
    type: Date,
    required: true
  },
  userAgent: String,
  ipAddress: String,
  provider: {
    type: String,
    default: 'local'
  },
  remember: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  revokedAt: Date,
  revokedReason: String,
  loggedOutAt: Date
}, {
  timestamps: true
});

// Indexes
sessionSchema.index({ refreshToken: 1 });
sessionSchema.index({ accessToken: 1 });
sessionSchema.index({ user: 1, isActive: 1 });
sessionSchema.index({ refreshTokenExpiry: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);