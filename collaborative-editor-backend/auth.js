const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('./models/User');
const Session = require('./models/Session');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }
  
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  
  const [localPart, domainPart] = parts;
  
  if (localPart.length === 0 || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (localPart.includes('..')) return false;
  
  if (domainPart.length === 0 || domainPart.length > 253) return false;
  if (domainPart.startsWith('-') || domainPart.endsWith('-')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  
  const domainParts = domainPart.split('.');
  if (domainParts.length < 2) return false;
  
  for (const part of domainParts) {
    if (part.length === 0 || part.length > 63) return false;
    if (part.startsWith('-') || part.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9-]+$/.test(part)) return false;
  }
  
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
  
  const blockedPatterns = [
    /^test@/i,
    /^admin@/i,
    /^noreply@/i,
    /example\.com$/i,
    /\.test$/i
  ];
  
  for (const pattern of blockedPatterns) {
    if (pattern.test(email)) return false;
  }
  
  return true;
};

const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (password.length > 128) {
    return { valid: false, message: 'Password must be less than 128 characters' };
  }
  
  const checks = {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
  
  const passedChecks = Object.values(checks).filter(Boolean).length;
  
  if (passedChecks < 3) {
    return { 
      valid: false, 
      message: 'Password must contain at least 3 of: lowercase, uppercase, number, special character' 
    };
  }
  
  const weakPatterns = [
    /^(.)\1+$/,
    /123456|password|qwerty|admin|letmein/i,
    /^[a-zA-Z]+$/,
    /^\d+$/,
  ];
  
  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      return { valid: false, message: 'Password is too weak. Please choose a stronger password.' };
    }
  }
  
  return { valid: true };
};

const validateUsername = (username) => {
  if (!username || username.length < 3) {
    return { valid: false, message: 'Username must be at least 3 characters long' };
  }
  
  if (username.length > 30) {
    return { valid: false, message: 'Username must be less than 30 characters' };
  }
  
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return { 
      valid: false, 
      message: 'Username can only contain letters, numbers, underscores, and hyphens' 
    };
  }
  
  const reservedNames = [
    'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail',
    'support', 'help', 'info', 'contact', 'service', 'noreply', 'test',
    'user', 'guest', 'public', 'private', 'null', 'undefined'
  ];
  
  if (reservedNames.includes(username.toLowerCase())) {
    return { valid: false, message: 'Username is reserved. Please choose another.' };
  }
  
  if (username.startsWith('_') || username.startsWith('-') || 
      username.endsWith('_') || username.endsWith('-')) {
    return { valid: false, message: 'Username cannot start or end with underscore or hyphen' };
  }
  
  return { valid: true };
};

const rateLimitStore = new Map();

const checkRateLimit = (identifier, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const key = `${identifier}`;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now, lastAttempt: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  const data = rateLimitStore.get(key);
  
  if (now - data.firstAttempt > windowMs) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now, lastAttempt: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  if (data.attempts >= maxAttempts) {
    const timeLeft = windowMs - (now - data.firstAttempt);
    return { 
      allowed: false, 
      remaining: 0, 
      retryAfter: Math.ceil(timeLeft / 1000 / 60)
    };
  }
  
  data.attempts++;
  data.lastAttempt = now;
  rateLimitStore.set(key, data);
  
  return { allowed: true, remaining: maxAttempts - data.attempts };
};

const generateAccessToken = (userId, userRole = 'user') => {
  try {
    const payload = {
      id: userId,
      role: userRole,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomBytes(16).toString('hex')
    };
    
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'collaborative-editor',
      audience: 'api',
      algorithm: 'HS256'
    });
    
    console.log('🔑 Access token generated for user:', userId);
    return token;
  } catch (error) {
    console.error('❌ Error generating access token:', error);
    throw new Error('Token generation failed');
  }
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

const generateTokens = async (userId, userRole, requestInfo = {}) => {
  const accessToken = generateAccessToken(userId, userRole);
  const refreshToken = generateRefreshToken();
  
  const accessTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
  const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  try {
    await Session.create({
      user: userId,
      refreshToken,
      accessToken,
      accessTokenExpiry,
      refreshTokenExpiry,
      userAgent: requestInfo.userAgent || 'unknown',
      ipAddress: requestInfo.ipAddress || 'unknown',
      provider: requestInfo.provider || 'local',
      isActive: true
    });
  } catch (error) {
    console.error('❌ Error storing session:', error);
    throw new Error('Session storage failed');
  }
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpiry,
    refreshTokenExpiry
  };
};

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'collaborative-editor',
      audience: 'api',
      algorithms: ['HS256']
    });
    
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type.',
        code: 'INVALID_TOKEN_TYPE'
      });
    }
    
    const session = await Session.findOne({
      accessToken: token,
      isActive: true,
      accessTokenExpiry: { $gt: new Date() }
    });
    
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Token not found or expired.',
        code: 'TOKEN_NOT_FOUND'
      });
    }
    
    const user = await User.findById(decoded.id).select('-password').lean();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended, locked, or deleted.',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    session.lastUsed = new Date();
    await session.save();
    
    req.user = user;
    req.userId = user._id;
    req.token = token;
    req.session = session;
    
    console.log('✅ Token verified for user:', user.username);
    next();
    
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh your token.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        message: 'Token not active yet.',
        code: 'TOKEN_NOT_ACTIVE'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
      code: 'AUTH_ERROR'
    });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    console.log('📝 Registration attempt:', { username, email, fullName, ip: clientIP });

    const rateLimitResult = checkRateLimit(clientIP, 3, 15 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many registration attempts. Please try again in ${rateLimitResult.retryAfter} minutes.`,
        code: 'RATE_LIMITED',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address (e.g., user@gmail.com)',
        code: 'INVALID_EMAIL'
      });
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({
        success: false,
        message: usernameValidation.message,
        code: 'INVALID_USERNAME'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message,
        code: 'WEAK_PASSWORD'
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: { $regex: new RegExp('^' + email.toLowerCase() + '$', 'i') } },
        { username: { $regex: new RegExp('^' + username.toLowerCase() + '$', 'i') } }
      ]
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists. Please use a different email or try logging in.',
          code: 'EMAIL_EXISTS'
        });
      }
      
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken. Please choose a different username.',
          code: 'USERNAME_EXISTS'
        });
      }
    }

    const user = new User({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      fullName: fullName ? fullName.trim() : username,
      provider: 'local',
      emailVerified: false,
      status: 'active',
      metadata: {
        signupSource: 'web',
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    });

    await user.save();
    
    const requestInfo = {
      userAgent: req.headers['user-agent'],
      ipAddress: clientIP,
      provider: 'local'
    };
    
    const tokens = await generateTokens(user._id, user.role, requestInfo);

    console.log('✅ User registered successfully:', username);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.metadata.ipAddress;

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to CodeCollab.',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.accessTokenExpiry,
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, remember = false } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    console.log('🔐 Login attempt for:', email, 'from IP:', clientIP);

    const rateLimitResult = checkRateLimit(`${email}-${clientIP}`, 5, 15 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many login attempts. Please try again in ${rateLimitResult.retryAfter} minutes.`,
        code: 'RATE_LIMITED',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
        code: 'INVALID_EMAIL_FORMAT'
      });
    }

    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + email.toLowerCase() + '$', 'i') }
    }).select('+password +failedLoginAttempts +lastFailedLogin +accountLockedUntil');
    
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'No account found with this email address. Please check your email or sign up.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const lockTimeLeft = Math.ceil((user.accountLockedUntil - new Date()) / 1000 / 60);
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked. Try again in ${lockTimeLeft} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockTimeLeft
      });
    }

    if (user.status !== 'active') {
      const statusMessages = {
        suspended: 'Your account has been suspended. Please contact support.',
        deleted: 'This account has been deleted. Please contact support.',
        locked: 'Your account has been locked. Please contact support.'
      };
      
      return res.status(403).json({
        success: false,
        message: statusMessages[user.status] || 'Your account is not active.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    const isPasswordMatch = await user.comparePassword(password);
    
    if (!isPasswordMatch) {
      console.log('❌ Invalid password for:', email);
      
      const currentFailures = (user.failedLoginAttempts || 0) + 1;
      user.failedLoginAttempts = currentFailures;
      user.lastFailedLogin = new Date();
      
      if (currentFailures >= 15) {
        user.accountLockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.status = 'locked';
      } else if (currentFailures >= 10) {
        user.accountLockedUntil = new Date(Date.now() + 60 * 60 * 1000);
      } else if (currentFailures >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      
      await user.save();
      
      const remainingAttempts = Math.max(0, 5 - currentFailures);
      let lockMessage = '';
      
      if (user.accountLockedUntil) {
        const lockMinutes = Math.ceil((user.accountLockedUntil - new Date()) / 1000 / 60);
        lockMessage = ` Account locked for ${lockMinutes} minutes.`;
      }
      
      return res.status(401).json({
        success: false,
        message: `Incorrect password. ${remainingAttempts} attempts remaining before lockout.${lockMessage}`,
        code: 'WRONG_PASSWORD',
        remainingAttempts,
        accountLocked: !!user.accountLockedUntil
      });
    }

    user.failedLoginAttempts = 0;
    user.lastFailedLogin = null;
    user.accountLockedUntil = null;
    user.isOnline = true;
    user.lastSeen = new Date();
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    
    if (user.status === 'locked') {
      user.status = 'active';
    }
    
    await user.save();

    const requestInfo = {
      userAgent: req.headers['user-agent'],
      ipAddress: clientIP,
      provider: 'local'
    };
    
    const tokens = await generateTokens(user._id, user.role, requestInfo);

    console.log('✅ Login successful for:', user.username);

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.failedLoginAttempts;
    delete userResponse.accountLockedUntil;

    res.json({
      success: true,
      message: `Welcome back, ${user.fullName || user.username}!`,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.accessTokenExpiry,
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const session = await Session.findOne({
      refreshToken,
      isActive: true,
      refreshTokenExpiry: { $gt: new Date() }
    }).populate('user', '-password');

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (!session.user || session.user.status !== 'active') {
      await session.updateOne({ isActive: false });
      return res.status(401).json({
        success: false,
        message: 'User account is no longer active',
        code: 'USER_INACTIVE'
      });
    }

    const accessToken = generateAccessToken(session.user._id, session.user.role);
    const accessTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    session.accessToken = accessToken;
    session.accessTokenExpiry = accessTokenExpiry;
    session.lastUsed = new Date();
    session.ipAddress = clientIP;
    await session.save();

    console.log('✅ Token refreshed for user:', session.user.username);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: accessToken,
      expiresIn: accessTokenExpiry
    });

  } catch (error) {
    console.error('❌ Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh',
      code: 'REFRESH_ERROR'
    });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken, logoutAll = false } = req.body;
    const userId = req.userId;

    if (logoutAll) {
      const result = await Session.updateMany(
        { user: userId, isActive: true },
        { 
          isActive: false, 
          loggedOutAt: new Date(),
          revokedReason: 'Logout all devices'
        }
      );
      console.log(`✅ User logged out from ${result.modifiedCount} sessions:`, userId);
    } else if (refreshToken) {
      await Session.findOneAndUpdate(
        { refreshToken, user: userId },
        { 
          isActive: false, 
          loggedOutAt: new Date(),
          revokedReason: 'Specific logout'
        }
      );
      console.log('✅ User logged out from specific session:', userId);
    } else {
      await Session.findOneAndUpdate(
        { accessToken: req.token, user: userId },
        { 
          isActive: false, 
          loggedOutAt: new Date(),
          revokedReason: 'Current session logout'
        }
      );
      console.log('✅ User logged out from current session:', userId);
    }

    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    res.json({
      success: true,
      message: logoutAll ? 'Logged out from all devices successfully' : 'Logged out successfully'
    });

  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
      code: 'LOGOUT_ERROR'
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const activeSessions = await Session.countDocuments({
      user: req.userId,
      isActive: true
    });

    res.json({
      success: true,
      user: {
        ...user,
        activeSessions
      }
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      code: 'SERVER_ERROR'
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message,
        code: 'WEAK_NEW_PASSWORD'
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
        code: 'SAME_PASSWORD'
      });
    }

    user.password = newPassword;
    await user.save();

    await Session.updateMany(
      { 
        user: userId, 
        accessToken: { $ne: req.token },
        isActive: true
      },
      { 
        isActive: false, 
        revokedAt: new Date(),
        revokedReason: 'Password changed - security logout'
      }
    );

    console.log('✅ Password changed for user:', user.username);

    res.json({
      success: true,
      message: 'Password changed successfully. Other sessions have been logged out for security.'
    });

  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      user: req.userId,
      isActive: true
    })
      .select('-refreshToken -accessToken')
      .sort('-lastUsed')
      .lean();

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        ...session,
        isCurrent: session.accessToken === req.token
      }))
    });

  } catch (error) {
    console.error('❌ Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOneAndUpdate(
      { _id: sessionId, user: req.userId },
      { 
        isActive: false, 
        revokedAt: new Date(),
        revokedReason: 'Manual revocation'
      }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });

  } catch (error) {
    console.error('❌ Revoke session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const cleanupExpiredSessions = async () => {
  try {
    const result = await Session.deleteMany({
      $or: [
        { refreshTokenExpiry: { $lt: new Date() } },
        { isActive: false, loggedOutAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      ]
    });
    
    console.log(`🧹 Cleaned up ${result.deletedCount} expired sessions`);
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Session cleanup error:', error);
    return 0;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyToken,
  register,
  login,
  refreshToken,
  logout,
  getMe,
  getSessions,
  revokeSession,
  changePassword,
  cleanupExpiredSessions,
  validateEmail,
  validatePassword,
  validateUsername,
  checkRateLimit
};