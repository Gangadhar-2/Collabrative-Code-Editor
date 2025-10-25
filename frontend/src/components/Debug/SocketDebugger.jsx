import { useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const SocketDebugger = () => {
  const { socket, connected } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (!socket || !connected) {
      console.log('🔴 Socket not connected');
      return;
    }

    console.log('🟢 Socket connected, ID:', socket.id);

    const handlers = [];

    const codeUpdatedHandler = (data) => {
      console.log('📥 RECEIVE: code-updated', {
        sender: data.user?.username,
        senderId: data.user?.id,
        myUserId: user?._id,
        fileId: data.fileId,
        contentLength: data.content?.length,
        projectId: data.projectId,
        roomId: data.roomId
      });
    };

    const codeChangeHandler = (data) => {
      console.log('📥 RECEIVE: code-change', data);
    };

    const errorHandler = (data) => {
      console.error('❌ SOCKET ERROR:', data);
    };

    const connectHandler = () => {
      console.log('✅ Socket connected');
    };

    const disconnectHandler = () => {
      console.log('❌ Socket disconnected');
    };

    socket.on('code-updated', codeUpdatedHandler);
    socket.on('code-change', codeChangeHandler);
    socket.on('error', errorHandler);
    socket.on('connect', connectHandler);
    socket.on('disconnect', disconnectHandler);

    handlers.push(
      { event: 'code-updated', handler: codeUpdatedHandler },
      { event: 'code-change', handler: codeChangeHandler },
      { event: 'error', handler: errorHandler },
      { event: 'connect', handler: connectHandler },
      { event: 'disconnect', handler: disconnectHandler }
    );

    console.log('✅ Debug listeners registered');

    return () => {
      console.log('🧹 Removing debug listeners');
      handlers.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    };
  }, [socket, connected, user]);

  return null;
};

export default SocketDebugger;