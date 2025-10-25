import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/auth';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        user: action.payload.user, 
        token: action.payload.token,
        isAuthenticated: true,
        error: null 
      };
    case 'LOGIN_ERROR':
      return { ...state, loading: false, error: action.payload, isAuthenticated: false };
    case 'LOGOUT':
      return { ...state, user: null, token: null, isAuthenticated: false, loading: false };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    loading: false,
    error: null
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUser();
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await authService.getProfile();
      if (response.success) {
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: { user: response.user, token: state.token } 
        });
      }
    } catch (error) {
      console.error('Load user error:', error);
      if (error.response?.status === 401) {
        logout();
      }
    }
  };

  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await authService.login(credentials);
      if (response.success) {
        localStorage.setItem('token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: { user: response.user, token: response.token } 
        });
        toast.success('Login successful!');
        return { success: true };
      } else {
        dispatch({ type: 'LOGIN_ERROR', payload: response.message });
        return { success: false, message: response.message };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      dispatch({ type: 'LOGIN_ERROR', payload: message });
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await authService.register(userData);
      if (response.success) {
        localStorage.setItem('token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: { user: response.user, token: response.token } 
        });
        toast.success('Registration successful!');
        return { success: true };
      } else {
        dispatch({ type: 'LOGIN_ERROR', payload: response.message });
        return { success: false, message: response.message };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'LOGIN_ERROR', payload: message });
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out...');
      
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      dispatch({ type: 'LOGOUT' });
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          await authService.logout({ refreshToken });
        }
      } catch (error) {

        if (error.response?.status === 401) {
          console.log('Backend logout notification failed (expected - token cleared)');
        } else {
          console.error('Logout notification error:', error.message);
        }
      }
      
      toast.success('Logged out successfully');
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      dispatch({ type: 'LOGOUT' });
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    loadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};