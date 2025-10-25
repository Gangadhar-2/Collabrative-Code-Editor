const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const Room = require('./models/SimplifiedRoom');
const User = require('./models/User');

class SocketService {
  constructor(server) {
    console.log('🔌 Initializing Socket.IO service...');

    this.io = socketIo(server, {
      cors: {
        origin: function (origin, callback) {
          const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            process.env.FRONTEND_URL,
            process.env.CLIENT_URL
          ].filter(Boolean);
          
          if (!origin) return callback(null, true);
          
          if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
          }
          
          if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(null, true);
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e8,
      path: '/socket.io/'
    });

    console.log('✅ Socket.IO configured with CORS and transports');

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          console.log('❌ Socket connection rejected - no token');
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId || decoded.id).select('-password');
        
        if (!user) {
          console.log('❌ Socket connection rejected - user not found');
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.username = user.username;
        socket.user = user;
        
        console.log('✅ Socket authenticated:', socket.username, `(${socket.id})`);
        next();
      } catch (error) {
        console.error('❌ Socket authentication failed:', error.message);
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log('🔌 New socket connection:', socket.username, `(${socket.id})`);
      this.handleConnection(socket);
    });

    console.log('✅ Socket.IO service initialized successfully');
  }

  handleConnection(socket) {
    socket.on('join-room', async (data) => {
      try {
        const { roomId } = data;
        console.log('📥', socket.username, 'joining room:', roomId);

        if (!roomId) {
          socket.emit('error', { message: 'Room ID is required' });
          return;
        }

        const room = await Room.findOne({ roomId }).populate('participants.user', 'username email');
        
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const roomKey = `room-${roomId}`;
        socket.join(roomKey);
        
        socket.currentRoom = roomId;
        socket.currentRoomKey = roomKey;

        const existingParticipant = room.participants.find(
          p => p.user._id.toString() === socket.userId
        );

        if (!existingParticipant) {
          room.participants.push({
            user: socket.userId,
            role: 'collaborator',
            joinedAt: new Date()
          });
          await room.save();
        }

        const participants = room.participants.map(p => ({
          user: {
            id: p.user._id.toString(),
            username: p.user.username,
            email: p.user.email
          },
          role: p.role,
          joinedAt: p.joinedAt,
          socketId: socket.id
        }));

        socket.emit('room-joined', {
          roomId,
          room,
          participants
        });

        socket.to(roomKey).emit('user-joined', {
          user: {
            id: socket.userId,
            username: socket.username
          },
          socketId: socket.id,
          timestamp: Date.now()
        });

        console.log('✅', socket.username, 'joined room:', roomId, '| participants:', participants.length);

      } catch (error) {
        console.error('❌ Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('code-change', async (data) => {
      try {
        const { roomId, fileId, content, projectId, language } = data;
        
        console.log('📥 CODE CHANGE from:', socket.username, {
          roomId,
          projectId,
          fileId,
          contentLength: content?.length,
          language,
          userId: socket.userId
        });

        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('code-updated', {
          fileId,
          content,
          language,
          user: {
            id: socket.userId,
            username: socket.username
          },
          projectId,
          roomId,
          timestamp: Date.now()
        });

        console.log('📤 CODE UPDATED broadcasted to:', roomKey, '| from:', socket.username);
        
      } catch (error) {
        console.error('❌ Error handling code change:', error);
        socket.emit('error', { message: 'Failed to sync code' });
      }
    });

    socket.on('cursor-position', async (data) => {
      try {
        const { roomId, projectId, fileId, position, selection } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('cursor-updated', {
          fileId,
          position,
          selection,
          user: {
            id: socket.userId,
            username: socket.username
          },
          timestamp: Date.now()
        });

        console.log('🖱️ Cursor position updated for:', socket.username);
        
      } catch (error) {
        console.error('❌ Error handling cursor position:', error);
      }
    });

    socket.on('leave-room', async (data) => {
      try {
        const { roomId } = data;
        console.log('📥', socket.username, 'leaving room:', roomId);

        if (!roomId) return;

        const roomKey = `room-${roomId}`;
        socket.leave(roomKey);

        const room = await Room.findOne({ roomId });
        if (room) {
          room.participants = room.participants.filter(
            p => p.user.toString() !== socket.userId
          );
          await room.save();
        }

        socket.to(roomKey).emit('user-left', {
          user: {
            id: socket.userId,
            username: socket.username
          },
          socketId: socket.id,
          timestamp: Date.now()
        });

        socket.currentRoom = null;
        socket.currentRoomKey = null;

        console.log('✅', socket.username, 'left room:', roomId);

      } catch (error) {
        console.error('❌ Error leaving room:', error);
      }
    });

    socket.on('send-message', async (data) => {
      try {
        const { roomId, projectId, message, type, channel } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        const messageData = {
          id: Date.now().toString(),
          user: {
            id: socket.userId,
            username: socket.username
          },
          message,
          type: type || 'text',
          channel: channel || 'chat',
          timestamp: Date.now()
        };

        this.io.to(roomKey).emit('new-message', messageData);

        console.log('💬 Message sent to:', roomKey, 'from:', socket.username);

      } catch (error) {
        console.error('❌ Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('project-created', async (data) => {
      try {
        const { project, roomId } = data;
        
        if (!roomId) return;
        
        const roomKey = `room-${roomId}`;
        
        socket.to(roomKey).emit('project-created', {
          project,
          user: {
            id: socket.userId,
            username: socket.username
          },
          timestamp: Date.now()
        });

        console.log('📁 Project created broadcast to:', roomKey);

      } catch (error) {
        console.error('❌ Error broadcasting project creation:', error);
      }
    });

    socket.on('project-deleted', async (data) => {
      try {
        const { projectId, projectName, roomId, redirectTo } = data;
        
        if (!roomId) return;
        
        const roomKey = `room-${roomId}`;
        
        socket.to(roomKey).emit('project-deleted', {
          projectId,
          projectName,
          deletedBy: socket.userId,
          deletedByUsername: socket.username,
          redirectTo,
          timestamp: Date.now()
        });

        console.log('🗑️ Project deleted broadcast to:', roomKey);

      } catch (error) {
        console.error('❌ Error broadcasting project deletion:', error);
      }
    });

    socket.on('join-project', async (data) => {
      try {
        const { projectId } = data;
        console.log('📥', socket.username, 'joining project:', projectId);

        if (!projectId) {
          socket.emit('error', { message: 'Project ID is required' });
          return;
        }

        const projectKey = `project-${projectId}`;
        socket.join(projectKey);
        
        socket.currentProject = projectId;
        socket.currentProjectKey = projectKey;

        socket.emit('project-joined', {
          projectId,
          timestamp: Date.now()
        });

        socket.to(projectKey).emit('user-joined-project', {
          user: {
            id: socket.userId,
            username: socket.username
          },
          projectId,
          socketId: socket.id,
          timestamp: Date.now()
        });

        console.log('✅', socket.username, 'joined project:', projectId);

      } catch (error) {
        console.error('❌ Error joining project:', error);
        socket.emit('error', { message: 'Failed to join project' });
      }
    });

    socket.on('leave-project', async (data) => {
      try {
        const { projectId } = data;
        console.log('📥', socket.username, 'leaving project:', projectId);

        if (!projectId) return;

        const projectKey = `project-${projectId}`;
        socket.leave(projectKey);

        socket.to(projectKey).emit('user-left-project', {
          user: {
            id: socket.userId,
            username: socket.username
          },
          projectId,
          socketId: socket.id,
          timestamp: Date.now()
        });

        socket.currentProject = null;
        socket.currentProjectKey = null;

        console.log('✅', socket.username, 'left project:', projectId);

      } catch (error) {
        console.error('❌ Error leaving project:', error);
      }
    });

    socket.on('file-created', async (data) => {
      try {
        const { file, roomId, projectId } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('file-created', {
          file,
          user: {
            id: socket.userId,
            username: socket.username
          },
          projectId,
          roomId,
          timestamp: Date.now()
        });

        console.log('📄 File created broadcast to:', roomKey);

      } catch (error) {
        console.error('❌ Error broadcasting file creation:', error);
      }
    });

    socket.on('file-deleted', async (data) => {
      try {
        const { fileId, fileName, roomId, projectId } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('file-deleted', {
          fileId,
          fileName,
          user: {
            id: socket.userId,
            username: socket.username
          },
          projectId,
          roomId,
          timestamp: Date.now()
        });

        console.log('🗑️ File deleted broadcast to:', roomKey);

      } catch (error) {
        console.error('❌ Error broadcasting file deletion:', error);
      }
    });

    socket.on('file-renamed', async (data) => {
      try {
        const { fileId, oldName, newName, roomId, projectId } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('file-renamed', {
          fileId,
          oldName,
          newName,
          user: {
            id: socket.userId,
            username: socket.username
          },
          projectId,
          roomId,
          timestamp: Date.now()
        });

        console.log('✏️ File renamed broadcast to:', roomKey);

      } catch (error) {
        console.error('❌ Error broadcasting file rename:', error);
      }
    });

    socket.on('file-updated', async (data) => {
      try {
        const { fileId, content, roomId, projectId, language } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('file-updated', {
          fileId,
          content,
          language,
          user: {
            id: socket.userId,
            username: socket.username
          },
          projectId,
          roomId,
          timestamp: Date.now()
        });

        console.log('📝 File updated broadcast to:', roomKey);

      } catch (error) {
        console.error('❌ Error broadcasting file update:', error);
      }
    });

    socket.on('code-executed', async (data) => {
      try {
        const { roomId, projectId, result } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('code-executed', {
          user: {
            id: socket.userId,
            username: socket.username
          },
          result,
          timestamp: Date.now()
        });

        console.log('▶️ Code execution broadcast to:', roomKey);

      } catch (error) {
        console.error('❌ Error broadcasting code execution:', error);
      }
    });

    socket.on('typing-start', async (data) => {
      try {
        const { roomId, projectId, fileId } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('user-typing', {
          user: {
            id: socket.userId,
            username: socket.username
          },
          fileId,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('❌ Error broadcasting typing start:', error);
      }
    });

    socket.on('typing-stop', async (data) => {
      try {
        const { roomId, projectId, fileId } = data;
        
        const roomKey = projectId ? `project-${projectId}` : `room-${roomId}`;
        
        socket.to(roomKey).emit('user-stopped-typing', {
          user: {
            id: socket.userId,
            username: socket.username
          },
          fileId,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('❌ Error broadcasting typing stop:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log('🔌 Socket disconnected:', socket.username, `(${socket.id})`);

      if (socket.currentRoom) {
        try {
          const room = await Room.findOne({ roomId: socket.currentRoom });
          if (room) {
            room.participants = room.participants.filter(
              p => p.user.toString() !== socket.userId
            );
            await room.save();
          }

          if (socket.currentRoomKey) {
            socket.to(socket.currentRoomKey).emit('user-left', {
              user: {
                id: socket.userId,
                username: socket.username
              },
              socketId: socket.id,
              timestamp: Date.now()
            });
          }

          console.log('👋', socket.username, 'removed from room on disconnect');

        } catch (error) {
          console.error('❌ Error handling disconnect:', error);
        }
      }

      if (socket.currentProject) {
        try {
          if (socket.currentProjectKey) {
            socket.to(socket.currentProjectKey).emit('user-left-project', {
              user: {
                id: socket.userId,
                username: socket.username
              },
              projectId: socket.currentProject,
              socketId: socket.id,
              timestamp: Date.now()
            });
          }

          console.log('👋', socket.username, 'removed from project on disconnect');

        } catch (error) {
          console.error('❌ Error handling project disconnect:', error);
        }
      }
    });
  }

  broadcastToRoom(roomId, event, data) {
    const roomKey = `room-${roomId}`;
    this.io.to(roomKey).emit(event, data);
    console.log(`📤 Broadcast ${event} to ${roomKey}`);
  }

  broadcastToProject(projectId, event, data) {
    const projectKey = `project-${projectId}`;
    this.io.to(projectKey).emit(event, data);
    console.log(`📤 Broadcast ${event} to ${projectKey}`);
  }

  async getRoomParticipants(roomId) {
    const roomKey = `room-${roomId}`;
    const sockets = await this.io.in(roomKey).fetchSockets();
    return sockets.map(socket => ({
      userId: socket.userId,
      username: socket.username,
      socketId: socket.id
    }));
  }

  async getProjectParticipants(projectId) {
    const projectKey = `project-${projectId}`;
    const sockets = await this.io.in(projectKey).fetchSockets();
    return sockets.map(socket => ({
      userId: socket.userId,
      username: socket.username,
      socketId: socket.id
    }));
  }
}

module.exports = SocketService;