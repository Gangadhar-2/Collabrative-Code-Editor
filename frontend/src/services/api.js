import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken
          });
          
          if (response.data.success) {
            localStorage.setItem('token', response.data.token);
            return api(original);
          }
        }
      } catch (refreshError) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth';
      }
    }
    
    return Promise.reject(error);
  }
);

export const apiService = {

  async getUserProfile(userId) {
    return await api.get(`/users/${userId}`);
  },
  
  async getCurrentUser() {
    return await api.get('/users/me');
  },
  
  async updateUserProfile(updates) {
    console.log('API: Updating user profile', updates);
    return await api.put('/users/profile', updates);
  },
  
  async updateUserPreferences(preferences) {
    return await api.put('/users/preferences', { preferences });
  },
  
  async updatePrivacySettings(privacy) {
    return await api.put('/users/privacy', { privacy });
  },
  
  async searchUsers(query, limit = 10) {
    return await api.get('/users/search', { params: { query, limit } });
  },

  async initializeWorkspace() {
    console.log('API: Initializing user workspace');
    return await api.post('/rooms/initialize-workspace');
  },
  
  async getUserWorkspace() {
    console.log('API: Getting user workspace');
    return await api.get('/rooms/workspace');
  },
  
  async updateWorkspaceSettings(settings) {
    return await api.put('/rooms/workspace/settings', settings);
  },

  async getRooms() {
    return await api.get('/rooms');
  },
  
  async getPublicRooms() {
    return await api.get('/rooms', { params: { includeUserRooms: false } });
  },
  
  async getUserRooms() {
    return await api.get('/rooms', { params: { includeUserRooms: true } });
  },
  
  async createRoom(roomData) {
    console.log('API: Creating room', roomData);
    return await api.post('/rooms', roomData);
  },

  async getRoom(roomId) {
    console.log('API: Getting room', roomId);
    return await api.get(`/rooms/${roomId}`);
  },
  
  async getRoomById(roomId) {
    console.log('API: Getting room by ID', roomId);
    return await api.get(`/rooms/${roomId}`);
  },
  
  async joinRoom(roomId) {
    console.log('API: Joining room', roomId);
    return await api.post(`/rooms/${roomId}/join`);
  },
  
  async leaveRoom(roomId) {
    console.log('API: Leaving room', roomId);
    return await api.post(`/rooms/${roomId}/leave`);
  },
  
  async deleteRoom(roomId) {
    console.log('API: Deleting room', roomId);
    return await api.delete(`/rooms/${roomId}`);
  },

  async getProjects(roomId = null) {
    const params = {};
    if (roomId) {
      params.roomId = roomId; 
      console.log('API: Getting projects for room', roomId);
    } else {
      console.log('API: Getting all projects');
    }
    return await api.get('/projects', { params });
  },
  
  async createProject(projectData, roomId = null) {
    console.log('API: Creating project', { ...projectData, roomId });
    return await api.post('/projects', {
      ...projectData,
      roomId 
    });
  },

  async getProject(projectId) {
    console.log('API: Getting project', projectId);
    return await api.get(`/projects/${projectId}`);
  },
  
  async getProjectById(projectId) {
    return await api.get(`/projects/${projectId}`);
  },
  
  async updateProject(projectId, updates) {
    return await api.put(`/projects/${projectId}`, updates);
  },
  
  async deleteProject(projectId) {
    console.log(`API: Deleting project ${projectId}`);
    return await api.delete(`/projects/${projectId}`);
  },
  
  async getProjectStats(projectId) {
    return await api.get(`/projects/${projectId}/stats`);
  },
  
  async forkProject(projectId) {
    return await api.post(`/projects/${projectId}/fork`);
  },
  
  async addCollaborator(projectId, collaboratorData) {
    return await api.post(`/projects/${projectId}/collaborators`, collaboratorData);
  },
  
  async removeCollaborator(projectId, userId) {
    return await api.delete(`/projects/${projectId}/collaborators/${userId}`);
  },

  async getProjectFiles(projectId) {
    console.log(`API: Getting files for project ${projectId}`);
    return await api.get(`/files/project/${projectId}`);
  },
  
  async getRoomFiles(roomId) {
    console.log(`API: Getting files for room ${roomId}`);
    return await api.get(`/files/room/${roomId}`);
  },
  
  async getFileTree(projectId) {
    return await api.get(`/files/tree/${projectId}`);
  },
  
  async getFileById(fileId) {
    return await api.get(`/files/${fileId}`);
  },

  async getFile(fileId, params = {}) {
    return await api.get(`/files/${fileId}`, { params });
  },
  
  async createFile(fileData) {
    console.log('API: Creating file', fileData);
    return await api.post('/files', fileData);
  },
  
  async updateFile(fileId, updates) {
    console.log(`API: Updating file ${fileId}`, updates);
    return await api.put(`/files/${fileId}`, updates);
  },
  
  async deleteFile(fileId, params = {}) {
    console.log(`API: Deleting file ${fileId}`, params);
    const queryString = new URLSearchParams(params).toString();
    return await api.delete(`/files/${fileId}${queryString ? `?${queryString}` : ''}`);
  },
  
  async renameFile(fileId, data) {
    console.log(`API: Renaming file ${fileId}`, data);
    return await api.put(`/files/${fileId}/rename`, data);
  },
  
  async restoreFile(fileId) {
    return await api.post(`/files/${fileId}/restore`);
  },
  
  async searchFiles(projectId, query, options = {}) {
    return await api.get(`/files/project/${projectId}/search`, {
      params: { q: query, ...options }
    });
  },

  async executeCode(codeData) {
    console.log('API: Executing code', codeData);
    if (typeof codeData === 'object' && codeData.code) {
      return await api.post('/execute', codeData);
    } else {
      const [code, language, stdin = '', roomId = null] = arguments;
      return await api.post('/execute', { 
        code: codeData, 
        language, 
        stdin, 
        roomId 
      });
    }
  },
  
  async getExecutionHistory(params = {}) {
    return await api.get('/code-executions', { params });
  },
  
  async getExecutionById(executionId) {
    return await api.get(`/code-executions/${executionId}`);
  },

  async getExecution(executionId) {
    return await api.get(`/code-executions/${executionId}`);
  },

  async deleteExecution(executionId) {
    return await api.delete(`/code-executions/${executionId}`);
  },
  
  async getSupportedLanguages() {
    return await api.get('/execute/languages');
  },

  async getLanguages() {
    return await api.get('/execute/languages');
  },
  
  async getExecutionStats(userId) {
    return await api.get(`/code-executions/stats/${userId}`);
  },
  async getRoomMessages(roomId, params = {}) {
    return await api.get(`/messages/room/${roomId}`, { params });
  },
  
  async sendRoomMessage(roomId, message, type = 'text') {
    return await api.post(`/messages/room/${roomId}`, { message, type });
  },
  
  async getProjectMessages(projectId, params = {}) {
    return await api.get(`/chat/project/${projectId}/messages`, { params });
  },
  
  async sendProjectMessage(projectId, message, channel = 'general') {
    return await api.post(`/chat/project/${projectId}/messages`, { message, channel });
  },
  
  async deleteMessage(messageId) {
    return await api.delete(`/chat/messages/${messageId}`);
  },
  
  async getChatStats(projectId) {
    return await api.get(`/chat/project/${projectId}/stats`);
  },
  
  async clearRoomChat(roomId, params = {}) {
    console.log(`API: Clearing chat for room ${roomId}`);
    return await api.delete(`/messages/room/${roomId}/clear`, { params });
  },

  async clearProjectChat(projectId, params = {}) {
    console.log(`API: Clearing chat for project ${projectId}`);
    return await api.delete(`/chat/project/${projectId}/clear`, { params });
  },

  async inviteToProject(projectId, inviteData) {
    return await api.post(`/projects/${projectId}/invite`, inviteData);
  },
  
  async acceptInvitation(invitationId) {
    return await api.post(`/invitations/${invitationId}/accept`);
  },
  
  async rejectInvitation(invitationId) {
    return await api.post(`/invitations/${invitationId}/reject`);
  },
  
  async getInvitations() {
    return await api.get('/invitations');
  },

  async getActivityFeed(params = {}) {
    return await api.get('/activity', { params });
  },
  
  async getProjectActivity(projectId, params = {}) {
    return await api.get(`/projects/${projectId}/activity`, { params });
  },
  
  async getUserActivity(userId, params = {}) {
    return await api.get(`/users/${userId}/activity`, { params });
  },
  
  async getDashboardStats() {
    return await api.get('/dashboard/stats');
  },

  async getTemplates(params = {}) {
    return await api.get('/templates', { params });
  },
  
  async createTemplate(templateData) {
    return await api.post('/templates', templateData);
  },
  
  async useTemplate(templateId, projectData) {
    return await api.post(`/templates/${templateId}/use`, projectData);
  },

  async getSystemSettings() {
    return await api.get('/settings');
  },
  
  async updateSystemSettings(settings) {
    return await api.put('/settings', settings);
  },
  
  async getLanguageConfig() {
    return await api.get('/settings/languages');
  },

  async exportProject(projectId, format = 'zip') {
    return await api.get(`/projects/${projectId}/export`, {
      params: { format },
      responseType: 'blob'
    });
  },
  
  async importProject(formData) {
    return await api.post('/projects/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  async backupProject(projectId) {
    return await api.post(`/projects/${projectId}/backup`);
  },
  
  async restoreProject(projectId, backupId) {
    return await api.post(`/projects/${projectId}/restore/${backupId}`);
  },

  async checkHealth() {
    return await api.get('/health');
  },
  
  async uploadFile(formData, onUploadProgress) {
    return await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  },
  
  async downloadFile(fileId) {
    return await api.get(`/files/${fileId}/download`, {
      responseType: 'blob'
    });
  },
  
  async customRequest(method, endpoint, data = null, config = {}) {
    const requestConfig = {
      method: method.toLowerCase(),
      url: endpoint,
      ...config
    };
    
    if (data) {
      if (method.toLowerCase() === 'get') {
        requestConfig.params = data;
      } else {
        requestConfig.data = data;
      }
    }
    
    return await api(requestConfig);
  },

  async login(credentials) {
    return await api.post('/auth/login', credentials);
  },

  async register(userData) {
    return await api.post('/auth/register', userData);
  },

  async logout() {
    return await api.post('/auth/logout');
  },

  async getProfile() {
    return await api.get('/users/profile');
  },

  async updateProfile(updates) {
    return await api.put('/users/profile', updates);
  },

  async uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append('profilePicture', file);
    return await api.post('/users/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export default apiService;