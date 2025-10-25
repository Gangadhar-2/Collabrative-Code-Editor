import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  const fileEventCallbacks = useRef({
    onFileCreated: null,
    onFileDeleted: null,
    onFileRenamed: null
  });

  useEffect(() => {
    if (token && user) {
      initSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [token, user]);

  const initSocket = () => {
    if (socketRef.current?.connected) {
      console.log('Socket already connected');
      return;
    }

    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
    
    console.log('Initializing socket connection to:', serverUrl);
    
    socketRef.current = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts
    });

    const sock = socketRef.current;

    sock.on('connect', () => {
      console.log('✅ Connected to server, Socket ID:', sock.id);
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      
      const lastRoomId = sessionStorage.getItem('currentRoomId');
      if (lastRoomId && lastRoomId !== 'null') {
        console.log('Rejoining previous room:', lastRoomId);
        sock.emit('join-room', { roomId: lastRoomId });
      }
    });

    sock.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setConnected(false);
      
      if (reason === 'io server disconnect') {
        sock.connect();
      }
    });

    sock.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      reconnectAttemptsRef.current++;
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        toast.error('Unable to connect to server. Please refresh the page.');
      }
    });

    sock.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      toast.success('Reconnected to server');
    });

    sock.on('room-joined', (data) => {
      console.log('Joined room:', data.roomId);
      setRoomId(data.roomId);
      setParticipants(data.participants || []);
      sessionStorage.setItem('currentRoomId', data.roomId);
      toast.success('Joined room successfully');
    });

    sock.on('user-joined', (data) => {
      console.log('User joined:', data.user?.username);
      setParticipants(prev => {
        const userId = data.user?.id?.toString();
        const exists = prev.find(p => p.user?.id?.toString() === userId);
        
        if (!exists) {
          toast.success(`${data.user?.username} joined the room`, {
            duration: 3000
          });
          return [...prev, data];
        }
        return prev;
      });
    });

    sock.on('user-left', (data) => {
      console.log('User left:', data.user?.username);
      
      const leftUserId = data.user?.id?.toString();
      setParticipants(prev => prev.filter(p => p.user?.id?.toString() !== leftUserId));
      
      toast(`${data.user?.username} left the room`, {
        duration: 2000
      });
    });

    sock.on('file-created', (data) => {
      console.log('📁 File created:', data.file?.name, 'by', data.user?.username);
      
      const creatorId = data.user?.id?.toString();
      const currentUserId = user?._id?.toString();
      
      if (creatorId !== currentUserId) {
        toast.success(`${data.user?.username} created ${data.file?.name}`, {
          duration: 3000,
          icon: '📄'
        });
      }
      
      if (fileEventCallbacks.current.onFileCreated) {
        fileEventCallbacks.current.onFileCreated(data);
      }
    });

    sock.on('file-deleted', (data) => {
      console.log('🗑️ File deleted:', data.fileName, 'by', data.user?.username);
      
      const deleterId = data.user?.id?.toString();
      const currentUserId = user?._id?.toString();
      
      if (deleterId !== currentUserId) {
        toast.error(`${data.user?.username} deleted ${data.fileName}`, {
          duration: 3000,
          icon: '🗑️'
        });
      }
      
      if (fileEventCallbacks.current.onFileDeleted) {
        fileEventCallbacks.current.onFileDeleted(data);
      }
    });

    sock.on('file-renamed', (data) => {
      console.log('✏️ File renamed:', data.oldName, '→', data.newName, 'by', data.user?.username);
      
      const renamerId = data.user?.id?.toString();
      const currentUserId = user?._id?.toString();
      
      if (renamerId !== currentUserId) {
        toast.info(`${data.user?.username} renamed "${data.oldName}" to "${data.newName}"`, {
          duration: 3000,
          icon: '✏️'
        });
      }
      
      if (fileEventCallbacks.current.onFileRenamed) {
        fileEventCallbacks.current.onFileRenamed(data);
      }
    });

    sock.on('code-updated', (data) => {
      console.log('📝 Code updated by:', data.user?.username);
    });
    sock.on('file-updated', (data) => {
      console.log('📝 File updated by:', data.user?.username);
    });

    sock.on('new-message', (messageData) => {
      console.log('💬 New message from:', messageData.user?.username);
    });

    sock.on('code-executed', (data) => {
      console.log('▶️ Code executed by:', data.username);
    });

    sock.on('error', (error) => {
      console.error('❌ Socket error:', error);
      toast.error(error.message || 'Socket error occurred');
    });

    setSocket(sock);
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
    setConnected(false);
    setRoomId(null);
    setParticipants([]);
    sessionStorage.removeItem('currentRoomId');
  };

  const joinRoom = useCallback((roomId) => {
    if (socket && connected && roomId) {
      console.log('Joining room:', roomId);
      socket.emit('join-room', { roomId });
      sessionStorage.setItem('currentRoomId', roomId);
    } else {
      console.warn('Cannot join room - socket not ready:', {
        hasSocket: !!socket,
        connected,
        roomId
      });
    }
  }, [socket, connected]);

  const leaveRoom = useCallback(() => {
    if (socket && connected && roomId) {
      console.log('Leaving room:', roomId);
      socket.emit('leave-room', { roomId });
      setRoomId(null);
      setParticipants([]);
      sessionStorage.removeItem('currentRoomId');
    }
  }, [socket, connected, roomId]);

  const sendMessage = useCallback((message, type = 'text', channel = 'chat') => {
    if (socket && connected && roomId) {
      socket.emit('send-message', { 
        roomId, 
        message, 
        type,
        channel 
      });
    } else {
      console.warn('Cannot send message - not connected to room');
    }
  }, [socket, connected, roomId]);

  const updateFileContent = useCallback((fileId, content, language) => {
    if (socket && connected && roomId) {
      socket.emit('file-content-change', { 
        roomId, 
        fileId, 
        content,
        language
      });
    }
  }, [socket, connected, roomId]);

  const registerFileCallbacks = useCallback((callbacks) => {
    console.log('Registering file callbacks');
    fileEventCallbacks.current = {
      ...fileEventCallbacks.current,
      ...callbacks
    };
  }, []);

  const value = {
    socket,
    connected,
    roomId,
    participants,
    joinRoom,
    leaveRoom,
    sendMessage,
    updateFileContent,
    registerFileCallbacks
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext };

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};