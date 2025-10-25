import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, Code, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const { isAuthenticated, login, register, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    fullName: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const validateEmail = (email) => {
    if (!email) return 'Email is required';
    
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address (e.g., user@gmail.com)';
    }
    
    const parts = email.split('@');
    if (parts.length !== 2) return 'Invalid email format';
    
    const [localPart, domainPart] = parts;
    
    if (localPart.length === 0 || localPart.length > 64) {
      return 'Email local part must be 1-64 characters';
    }
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return 'Email cannot start or end with a dot';
    }
    if (localPart.includes('..')) {
      return 'Email cannot contain consecutive dots';
    }
    
    if (domainPart.length === 0 || domainPart.length > 253) {
      return 'Email domain is too long';
    }
    if (domainPart.startsWith('-') || domainPart.endsWith('-')) {
      return 'Email domain cannot start or end with a hyphen';
    }
    if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
      return 'Email domain cannot start or end with a dot';
    }
    
    const domainParts = domainPart.split('.');
    if (domainParts.length < 2) {
      return 'Email must have a valid domain with extension (e.g., .com, .org)';
    }
    
    for (const part of domainParts) {
      if (part.length === 0 || part.length > 63) {
        return 'Invalid domain format';
      }
      if (part.startsWith('-') || part.endsWith('-')) {
        return 'Invalid domain format';
      }
      if (!/^[a-zA-Z0-9-]+$/.test(part)) {
        return 'Domain contains invalid characters';
      }
    }
    
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      return 'Email must have a valid domain extension (e.g., .com, .org, .net)';
    }
    
    const invalidTlds = ['co', 'c', 'o', 'gmai', 'yaho', 'hotmai'];
    if (invalidTlds.includes(tld.toLowerCase())) {
      return 'Please complete the email domain (e.g., gmail.com instead of gmai)';
    }
    
    const blockedPatterns = [
      /^test@/i,
      /^admin@/i,
      /^noreply@/i,
      /example\.com$/i,
      /\.test$/i
    ];
    
    for (const pattern of blockedPatterns) {
      if (pattern.test(email)) {
        return 'Please use a real email address';
      }
    }
    
    return '';
  };

  const validatePassword = (password) => {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    return '';
  };

  const validateUsername = (username) => {
    if (!username) return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters long';
    if (username.length > 30) return 'Username must be less than 30 characters';
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    
    const reservedNames = [
      'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail',
      'support', 'help', 'info', 'contact', 'service', 'noreply', 'test'
    ];
    
    if (reservedNames.includes(username.toLowerCase())) {
      return 'Username is reserved. Please choose another.';
    }
    
    if (username.startsWith('_') || username.startsWith('-') || 
        username.endsWith('_') || username.endsWith('-')) {
      return 'Username cannot start or end with underscore or hyphen';
    }
    
    return '';
  };

  const validateFullName = (fullName) => {
    if (!fullName) return 'Full name is required';
    if (fullName.length < 2) return 'Full name must be at least 2 characters long';
    if (fullName.length > 100) return 'Full name must be less than 100 characters';
    return '';
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        return validateEmail(value);
      case 'password':
        return validatePassword(value);
      case 'username':
        return validateUsername(value);
      case 'fullName':
        return validateFullName(value);
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (fieldTouched[name]) {
      const error = validateField(name, value);
      setValidationErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setFieldTouched(prev => ({
      ...prev,
      [name]: true
    }));

    const error = validateField(name, value);
    setValidationErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const validateForm = () => {
    const errors = {};
    
    errors.email = validateEmail(formData.email);
    errors.password = validatePassword(formData.password);
    
    if (!isLogin) {
      errors.username = validateUsername(formData.username);
      errors.fullName = validateFullName(formData.fullName);
    }
    
    setValidationErrors(errors);
    
    return Object.values(errors).every(error => !error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const touchedFields = {};
    Object.keys(formData).forEach(key => {
      if (isLogin && (key === 'email' || key === 'password')) {
        touchedFields[key] = true;
      } else if (!isLogin) {
        touchedFields[key] = true;
      }
    });
    setFieldTouched(touchedFields);
    
    if (!validateForm()) {
      toast.error('Please correct the errors below');
      return;
    }
    
    if (isLogin) {
      const result = await login({ 
        email: formData.email.trim(), 
        password: formData.password 
      });
      
      if (!result.success && result.message) {
        if (result.message.includes('not found') || result.message.includes('No account found')) {
          toast.error('No account found with this email address. Please check your email or sign up.');
        } else if (result.message.includes('password') || result.message.includes('Incorrect password')) {
          toast.error('Incorrect password. Please check your password and try again.');
        } else if (result.message.includes('locked') || result.message.includes('suspended')) {
          toast.error(result.message);
        } else {
          toast.error(result.message);
        }
      }
    } else {
      const result = await register(formData);
      
      if (!result.success && result.message) {
        if (result.message.includes('already exists') || result.message.includes('already taken')) {
          if (result.message.includes('email')) {
            toast.error('An account with this email already exists. Try logging in instead.');
          } else if (result.message.includes('username')) {
            toast.error('This username is already taken. Please choose a different username.');
          } else {
            toast.error(result.message);
          }
        } else {
          toast.error(result.message);
        }
      }
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setValidationErrors({});
    setFieldTouched({});
    setShowPassword(false);
    setFormData({
      email: '',
      password: '',
      username: '',
      fullName: ''
    });
  };

  const getFieldError = (fieldName) => {
    return fieldTouched[fieldName] && validationErrors[fieldName];
  };

  const isFieldValid = (fieldName) => {
    return fieldTouched[fieldName] && !validationErrors[fieldName] && formData[fieldName];
  };

  return (
    <div className="min-h-screen flex login-page">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-800 via-blue-800 to-indigo-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 p-12 flex flex-col justify-center text-white">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Code className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold">CodeCollab</h1>
            </div>
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Code Together,<br />Create Amazing Things
            </h2>
            <p className="text-xl text-purple-100">
              Real-time collaborative coding with instant execution and live chat
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Real-time Collaboration</h3>
                <p className="text-purple-100">Code together with your team in real-time</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Instant Code Execution</h3>
                <p className="text-purple-100">Run code in 5+ languages instantly</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💬</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Live Chat</h3>
                <p className="text-purple-100">Communicate while coding</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Code className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {isLogin ? 'Welcome Back!' : 'Join CodeCollab'}
              </h2>
              <p className="text-gray-300">
                {isLogin 
                  ? 'Sign in to continue coding' 
                  : 'Create your account to start collaborating'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`w-full pl-10 pr-10 py-3 bg-white/10 border rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur transition-colors ${
                          getFieldError('fullName') 
                            ? 'border-red-400 focus:ring-red-400' 
                            : isFieldValid('fullName') 
                              ? 'border-green-400 focus:ring-green-400' 
                              : 'border-white/20'
                        }`}
                        placeholder="Enter your full name"
                      />
                      {isFieldValid('fullName') && (
                        <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
                      )}
                      {getFieldError('fullName') && (
                        <AlertCircle className="absolute right-3 top-3 w-5 h-5 text-red-400" />
                      )}
                    </div>
                    {getFieldError('fullName') && (
                      <p className="mt-1 text-sm text-red-300 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {getFieldError('fullName')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Username *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={`w-full pl-10 pr-10 py-3 bg-white/10 border rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur transition-colors ${
                          getFieldError('username') 
                            ? 'border-red-400 focus:ring-red-400' 
                            : isFieldValid('username') 
                              ? 'border-green-400 focus:ring-green-400' 
                              : 'border-white/20'
                        }`}
                        placeholder="Choose a username"
                      />
                      {isFieldValid('username') && (
                        <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
                      )}
                      {getFieldError('username') && (
                        <AlertCircle className="absolute right-3 top-3 w-5 h-5 text-red-400" />
                      )}
                    </div>
                    {getFieldError('username') && (
                      <p className="mt-1 text-sm text-red-300 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {getFieldError('username')}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full pl-10 pr-10 py-3 bg-white/10 border rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur transition-colors ${
                      getFieldError('email') 
                        ? 'border-red-400 focus:ring-red-400' 
                        : isFieldValid('email') 
                          ? 'border-green-400 focus:ring-green-400' 
                          : 'border-white/20'
                    }`}
                    placeholder="Enter your email address"
                  />
                  {isFieldValid('email') && (
                    <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
                  )}
                  {getFieldError('email') && (
                    <AlertCircle className="absolute right-3 top-3 w-5 h-5 text-red-400" />
                  )}
                </div>
                {getFieldError('email') && (
                  <p className="mt-1 text-sm text-red-300 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {getFieldError('email')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full pl-10 pr-12 py-3 bg-white/10 border rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur transition-colors ${
                      getFieldError('password') 
                        ? 'border-red-400 focus:ring-red-400' 
                        : isFieldValid('password') 
                          ? 'border-green-400 focus:ring-green-400' 
                          : 'border-white/20'
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 w-5 h-5 text-gray-400 hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {getFieldError('password') && (
                  <p className="mt-1 text-sm text-red-300 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {getFieldError('password')}
                  </p>
                )}
                {!isLogin && (
                  <div className="mt-2 text-xs text-gray-400">
                    Password must be at least 8 characters with uppercase, lowercase, and number
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Please wait...</span>
                  </div>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-purple-300 hover:text-purple-200 transition-colors text-sm underline"
                >
                  {isLogin 
                    ? "Don't have an account? Sign up here" 
                    : "Already have an account? Sign in here"
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;