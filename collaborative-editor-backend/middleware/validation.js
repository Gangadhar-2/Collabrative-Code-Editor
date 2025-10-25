const validateRoomId = (req, res, next) => {
  const { roomId } = req.params;
  
  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'Room ID is required'
    });
  }

  if (!/^\d{8}$/.test(roomId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid room ID format. Must be 8 digits.'
    });
  }
  
  next();
};

const validateProjectId = (req, res, next) => {
  const { projectId } = req.params;
  
  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: 'Project ID is required'
    });
  }
  
  if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid project ID format'
    });
  }
  
  next();
};

const validateFileData = (req, res, next) => {
  const { name, content, fileType } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'File name is required'
    });
  }
  
  if (name.length > 255) {
    return res.status(400).json({
      success: false,
      message: 'File name too long (max 255 characters)'
    });
  }
  
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(name)) {
    return res.status(400).json({
      success: false,
      message: 'File name contains invalid characters'
    });
  }
  
  const allowedTypes = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'html', 'css', 'json', 'markdown'];
  if (fileType && !allowedTypes.includes(fileType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`
    });
  }
  
  if (content && content.length > 10 * 1024 * 1024) { 
    return res.status(400).json({
      success: false,
      message: 'File content too large (max 10MB)'
    });
  }
  
  next();
};

const validateMessageContent = (req, res, next) => {
  const { message, content } = req.body;
  const messageContent = message || content;
  
  if (!messageContent || !messageContent.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required'
    });
  }
  
  if (messageContent.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be empty'
    });
  }
  
  if (messageContent.length > 5000) {
    return res.status(400).json({
      success: false,
      message: 'Message too long (max 5000 characters)'
    });
  }
  
  next();
};

const validateProjectData = (req, res, next) => {
  const { name, projectType, primaryLanguage } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Project name is required'
    });
  }
  
  if (name.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Project name too long (max 100 characters)'
    });
  }
  
  const allowedProjectTypes = ['web', 'backend', 'desktop', 'mobile'];
  if (projectType && !allowedProjectTypes.includes(projectType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid project type. Allowed: ${allowedProjectTypes.join(', ')}`
    });
  }
  
  const allowedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c'];
  if (primaryLanguage && !allowedLanguages.includes(primaryLanguage)) {
    return res.status(400).json({
      success: false,
      message: `Invalid language. Allowed: ${allowedLanguages.join(', ')}`
    });
  }
  
  next();
};

const validateCodeExecution = (req, res, next) => {
  const { code, language } = req.body;
  
  if (!code || !code.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Code is required'
    });
  }
  
  if (code.length > 100000) { 
    return res.status(400).json({
      success: false,
      message: 'Code too large (max 100KB)'
    });
  }
  
  const allowedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c'];
  if (language && !allowedLanguages.includes(language.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid language. Allowed: ${allowedLanguages.join(', ')}`
    });
  }
  
  next();
};

const validateRoomData = (req, res, next) => {
  const { name, description } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Room name is required'
    });
  }
  
  if (name.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Room name too long (max 50 characters)'
    });
  }
  
  if (description && description.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Description too long (max 500 characters)'
    });
  }
  
  next();
};

const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/\0/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }
  
  next();
};

module.exports = {
  validateRoomId,
  validateProjectId,
  validateFileData,
  validateMessageContent,
  validateProjectData,
  validateCodeExecution,
  validateRoomData,
  sanitizeInput
};