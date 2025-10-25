
export const formatTime = (timestamp) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    return 'Invalid time';
  }
};

export const formatDate = (timestamp) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  } catch (error) {
    return 'Invalid date';
  }
};

export const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

export const getLanguageFromExtension = (filename) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  const languageMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'txt': 'plaintext'
  };
  return languageMap[extension] || 'plaintext';
};

export const getFileIcon = (filename, isDirectory = false) => {
  if (isDirectory) return '📁';
  
  const extension = filename.split('.').pop()?.toLowerCase();
  const iconMap = {
    'js': '📄',
    'ts': '📘',
    'py': '🐍',
    'java': '☕',
    'cpp': '⚡',
    'c': '🔧',
    'html': '🌐',
    'css': '🎨',
    'json': '📋'
  };
  return iconMap[extension] || '📄';
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password.length >= 6;
};

export const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export const compareUserIds = (userId1, userId2) => {
  if (!userId1 || !userId2) return false;
  
  const id1 = typeof userId1 === 'object' ? (userId1._id || userId1.id) : userId1;
  const id2 = typeof userId2 === 'object' ? (userId2._id || userId2.id) : userId2;
  
  return id1?.toString() === id2?.toString();
};

export const extractUserId = (userOrId) => {
  if (!userOrId) return null;
  
  if (typeof userOrId === 'string') return userOrId;
  if (typeof userOrId === 'object') return userOrId._id || userOrId.id;
  
  return null;
};

export const isCreator = (creatorId, currentUserId) => {
  return compareUserIds(creatorId, currentUserId);
};

export const getUserDisplayName = (user) => {
  if (!user) return 'Unknown User';
  return user.username || user.fullName || user.email?.split('@')[0] || 'User';
};

export const getUserInitials = (user) => {
  if (!user) return 'U';
  
  const name = user.username || user.fullName || 'User';
  const parts = name.split(' ');
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  
  return name.substring(0, 2).toUpperCase();
};