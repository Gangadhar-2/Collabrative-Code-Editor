const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const API_PREFIX = '/api';

const connectDatabase = require('./database');
const SocketService = require('./socket');
const { verifyToken } = require('./auth');
const auth = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

connectDatabase()
  .then(() => {
    console.log('✅ Database connected successfully');
    
    const { cleanupExpiredSessions } = require('./auth');
    setInterval(async () => {
      try {
        await cleanupExpiredSessions();
      } catch (error) {
        console.error('❌ Session cleanup failed:', error);
      }
    }, 60 * 60 * 1000); 
    
    console.log('✅ Session cleanup scheduled (runs every hour)');
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });

let socketService;
try {
  socketService = new SocketService(server);
  console.log('✅ Socket.IO service initialized');
  app.set('io', socketService.io);
} catch (error) {
  console.error('❌ Failed to initialize Socket.IO:', error);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit'],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, 
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && 
           (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.includes('localhost'));
  }
});

app.use(`${API_PREFIX}/`, limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, 
  skipSuccessfulRequests: true,
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && 
           (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.includes('localhost'));
  }
});

app.use(`${API_PREFIX}/auth/login`, authLimiter);
app.use(`${API_PREFIX}/auth/register`, authLimiter);

app.use((req, res, next) => {
  req.id = require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-Id', req.id);
  next();
});

const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/rooms');
const executeRoutes = require('./routes/execute');
const codeExecutionsRoutes = require('./routes/codeExecutions');

let projectRoutes, fileRoutes, userRoutes, chatRoutes, messagesRoutes;

try {
  projectRoutes = require('./routes/projects');
  console.log('✅ Projects routes loaded');
} catch (error) {
  console.warn('⚠️ Projects route not found');
  projectRoutes = express.Router();
  projectRoutes.get('/', (req, res) => {
    res.json({ success: true, data: { projects: [] } });
  });
}

try {
  fileRoutes = require('./routes/files');
  console.log('✅ Files routes loaded');
} catch (error) {
  console.warn('⚠️ Files route not found');
  fileRoutes = express.Router();
  fileRoutes.get('/project/:projectId', (req, res) => {
    res.json({ success: true, data: { files: [] } });
  });
}

try {
  userRoutes = require('./routes/users');
  console.log('✅ Users routes loaded');
} catch (error) {
  console.warn('⚠️ Users route not found');
  userRoutes = express.Router();
  userRoutes.get('/me', (req, res) => {
    res.json({ success: true, user: req.user });
  });
}

try {
  chatRoutes = require('./routes/chat');
  console.log('✅ Chat routes loaded');
} catch (error) {
  console.warn('⚠️ Chat route not found');
  chatRoutes = express.Router();
  chatRoutes.get('*', (req, res) => {
    res.status(501).json({ success: false, message: 'Chat not implemented' });
  });
}

try {
  messagesRoutes = require('./routes/messages');
  console.log('✅ Messages routes loaded');
} catch (error) {
  console.warn('⚠️ Messages route not found');
  messagesRoutes = express.Router();
  messagesRoutes.get('*', (req, res) => {
    res.status(501).json({ success: false, message: 'Messages not implemented' });
  });
}

app.get('/', (req, res) => {
  res.json({
    name: 'Collaborative Code Editor API',
    version: '1.0.0',
    status: 'Running',
    timestamp: new Date().toISOString(),
    features: {
      authentication: 'Local (Google OAuth removed)',
      realtime: 'Socket.IO',
      validation: 'Enabled',
      sessionCleanup: 'Enabled'
    }
  });
});

app.get('/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1;
    
    res.json({
      status: 'OK',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus ? 'Connected' : 'Disconnected',
        socket: socketService?.io ? 'Ready' : 'Not initialized'
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Service unavailable'
    });
  }
});

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/rooms`, verifyToken, roomRoutes);
app.use(`${API_PREFIX}/projects`, verifyToken, projectRoutes);
app.use(`${API_PREFIX}/files`, verifyToken, fileRoutes);
app.use(`${API_PREFIX}/users`, verifyToken, userRoutes);
app.use(`${API_PREFIX}/chat`, verifyToken, chatRoutes);
app.use(`${API_PREFIX}/execute`, verifyToken, executeRoutes);
app.use(`${API_PREFIX}/code-executions`, verifyToken, codeExecutionsRoutes);
app.use(`${API_PREFIX}/messages`, auth, messagesRoutes);

console.log('✅ All API routes configured');

app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`,
    requestId: req.id
  });
});

app.use((err, req, res, next) => {
  console.error(`[${req.id}] Error:`, err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      requestId: req.id
    });
  }

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
      requestId: req.id
    });
  }

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    requestId: req.id
  });
});

const gracefulShutdown = async (signal) => {
  console.log(`\n📝 ${signal} received. Shutting down...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  if (socketService?.io) {
    socketService.io.close(() => {
      console.log('✅ Socket.IO closed');
    });
  }

  try {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('✅ Database closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  🚀 Collaborative Code Editor Backend           ║
║  Port: ${PORT}                                       ║
║  Environment: ${process.env.NODE_ENV || 'development'}                          ║
║  Google OAuth: Removed ✅                        ║
║  Session Cleanup: Enabled ✅                     ║
║  📚 Ready to collaborate!                        ║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, socketService };