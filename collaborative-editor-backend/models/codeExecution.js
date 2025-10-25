const mongoose = require('mongoose');

const codeExecutionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  room: {
    type: String,
    required: true,
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  },
  language: {
    type: String,
    required: true,
    enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'c'],
    default: 'javascript'
  },
  version: {
    type: String,
    default: 'latest'
  },
  code: {
    type: String,
    required: true
  },
  stdin: String,
  stdout: String,
  stderr: String,
  compile_output: String,
  message: String,
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'timeout', 'cancelled'],
    default: 'queued'
  },
  exitCode: Number,
  executionTime: Number,
  memoryUsage: Number,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: Date,
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

codeExecutionSchema.index({ user: 1, createdAt: -1 });
codeExecutionSchema.index({ room: 1, createdAt: -1 });
codeExecutionSchema.index({ status: 1, createdAt: -1 });

codeExecutionSchema.virtual('duration').get(function() {
  if (this.completedAt && this.createdAt) {
    return this.completedAt - this.createdAt;
  }
  return null;
});

codeExecutionSchema.methods.updateStatus = function(status, outputs = {}) {
  this.status = status;
  
  if (status === 'completed' || status === 'failed' || status === 'timeout') {
    this.completedAt = new Date();
    

    if (outputs.stdout) this.stdout = outputs.stdout;
    if (outputs.stderr) this.stderr = outputs.stderr;
    if (outputs.compile_output) this.compile_output = outputs.compile_output;
    if (outputs.message) this.message = outputs.message;
    if (outputs.exitCode !== undefined) this.exitCode = outputs.exitCode;
    if (outputs.executionTime) this.executionTime = outputs.executionTime;
    if (outputs.memoryUsage) this.memoryUsage = outputs.memoryUsage;
  }
  
  return this.save();
};

codeExecutionSchema.statics.getExecutionStats = async function(userId) {
  try {
    return await this.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: {
        _id: '$language',
        count: { $sum: 1 },
        avgExecutionTime: { $avg: '$executionTime' },
        successCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        }
      }},
      { $project: {
        language: '$_id',
        count: 1,
        avgExecutionTime: 1,
        successRate: {
          $multiply: [
            { $divide: ['$successCount', '$count'] },
            100
          ]
        }
      }}
    ]);
  } catch (error) {
    console.error('Error in getExecutionStats:', error);
    return [];
  }
};

const CodeExecution = mongoose.model('CodeExecution', codeExecutionSchema);
module.exports = CodeExecution;