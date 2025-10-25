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
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const authService = {
  async login(credentials) {
    return await api.post('/auth/login', credentials);
  },

  async register(userData) {
    return await api.post('/auth/register', userData);
  },

  async logout(data) {
    return await api.post('/auth/logout', data);
  },

  async getProfile() {
    return await api.get('/auth/me');
  },

  async refreshToken(refreshToken) {
    return await api.post('/auth/refresh-token', { refreshToken });
  }
};