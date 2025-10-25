import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { Send, MessageCircle, X, Loader, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ChatPanel = ({ roomId, projectId, onClose }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesEndRef = useRef(null);
  const messageIdRef = useRef(new Set());

  useEffect(() => {
    if (roomId || projectId) {
      console.log('ChatPanel: Loading messages for', { roomId, projectId });
      messageIdRef.current.clear();
      setMessages([]);
      fetchMessages();
    }
  }, [roomId, projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewMessage = useCallback((messageData) => {
    console.log('ChatPanel: New message received via socket:', messageData);
    
    const messageId = messageData.id || messageData._id;
    
    if (messageIdRef.current.has(messageId)) {
      console.log('ChatPanel: Duplicate message prevented:', messageId);
      return;
    }
    
    messageIdRef.current.add(messageId);
    
    const formattedMessage = {
      _id: messageId,
      id: messageId,
      content: messageData.message || messageData.content,
      sender: {
        _id: messageData.user?.id || messageData.sender?._id || messageData.user?._id,
        username: messageData.user?.username || messageData.sender?.username,
        profilePicture: messageData.user?.profilePicture || messageData.sender?.profilePicture
      },
      timestamp: messageData.timestamp || new Date(),
      type: messageData.type || 'text'
    };
    
    console.log('Adding message with sender ID:', formattedMessage.sender._id, 'Current user ID:', user?._id);
    
    setMessages(prev => [...prev, formattedMessage]);
    
    if (formattedMessage.sender._id !== user?._id) {
      const messageText = messageData.message || messageData.content || '';
      const senderName = messageData.user?.username || messageData.sender?.username || 'Someone';
      
      const toastId = toast.success(`${senderName}: ${messageText.slice(0, 30)}${messageText.length > 30 ? '...' : ''}`, {
        duration: 3000,
        position: 'top-right',
        id: `msg-${messageId}`
      });
      
      setTimeout(() => toast.dismiss(toastId), 3000);
    }
  }, [user]);

  const handleChatCleared = useCallback((data) => {
    console.log('ChatPanel: Chat cleared event received:', data);
    
    setMessages([]);
    messageIdRef.current.clear();
    
    if (data.clearedBy?.id !== user?._id) {
      const toastId = toast.info(`${data.clearedBy?.username || 'Someone'} cleared the chat`, {
        duration: 3000,
        icon: '🗑️'
      });
      setTimeout(() => toast.dismiss(toastId), 3000);
    }
  }, [user]);

  useEffect(() => {
    if (socket) {
      socket.on('new-message', handleNewMessage);
      socket.on('chat-cleared', handleChatCleared);
      
      return () => {
        socket.off('new-message', handleNewMessage);
        socket.off('chat-cleared', handleChatCleared);
      };
    }
  }, [socket, handleNewMessage, handleChatCleared]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      let response;
      
      if (projectId) {
        console.log('Fetching project messages:', projectId);
        response = await apiService.getProjectMessages(projectId);
      } else if (roomId) {
        console.log('Fetching room messages:', roomId);
        response = await apiService.getRoomMessages(roomId);
      }
      
      if (response?.success) {
        const fetchedMessages = (response.data.messages || []).map(msg => {
          const messageId = msg._id || msg.id;
          messageIdRef.current.add(messageId);
          return {
            _id: messageId,
            id: messageId,
            content: msg.content || msg.message,
            sender: {
              _id: msg.sender?._id || msg.user?._id,
              username: msg.sender?.username || msg.user?.username,
              profilePicture: msg.sender?.profilePicture || msg.user?.profilePicture
            },
            timestamp: msg.timestamp,
            type: msg.type || 'text'
          };
        });
        
        console.log(`ChatPanel: Loaded ${fetchedMessages.length} messages from database`);
        setMessages(fetchedMessages);
      } else {
        console.warn('Failed to load messages:', response);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      const toastId = toast.error('Failed to load messages');
      setTimeout(() => toast.dismiss(toastId), 3000);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      let response;
      
      if (projectId) {
        response = await apiService.sendProjectMessage(projectId, messageText);
      } else if (roomId) {
        response = await apiService.sendRoomMessage(roomId, messageText);
      }

      if (response?.success) {
        console.log('Message sent successfully:', response.data.message);
        
      } else {
        throw new Error(response?.message || 'Failed to send message');
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      const toastId = toast.error('Failed to send message');
      setTimeout(() => toast.dismiss(toastId), 3000);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const confirmClearChat = async () => {
    setClearing(true);
    try {
      let response;
      
      if (projectId) {
        response = await apiService.clearProjectChat(projectId);
      } else if (roomId) {
        response = await apiService.clearRoomChat(roomId);
      }
      
      if (response?.success) {
        setMessages([]);
        messageIdRef.current.clear();
        
        const toastId = toast.success('Chat cleared successfully');
        setTimeout(() => toast.dismiss(toastId), 3000);
      } else {
        throw new Error(response?.message || 'Failed to clear chat');
      }
      
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Error clearing chat:', error);
      const toastId = toast.error('Failed to clear chat');
      setTimeout(() => toast.dismiss(toastId), 3000);
    } finally {
      setClearing(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-gray-400" />
          <span className="text-white font-medium">Chat</span>
          <span className="text-xs text-gray-500">({messages.length})</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              disabled={clearing}
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              title="Clear Chat (All Users)"
            >
              {clearing ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
          
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Close Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center space-y-2 text-gray-400">
              <Loader className="w-8 h-8 animate-spin" />
              <span>Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwnMessage = message.sender?._id === user?._id || message.sender?._id?.toString() === user?._id?.toString();
              const messageContent = message.content || message.message || '';
              const username = message.sender?.username || 'Unknown';
              
              console.log('Rendering message:', {
                messageId: message.id,
                senderIs: message.sender?._id,
                currentUser: user?._id,
                isOwn: isOwnMessage
              });
              
              return (
                <div key={message._id || message.id} className={`flex space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isOwnMessage ? 'bg-blue-600' : 'bg-purple-600'
                  }`}>
                    <span className="text-white text-sm font-bold">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  <div className={`flex-1 min-w-0 max-w-xs ${isOwnMessage ? 'text-right' : ''}`}>
                    <div className={`flex items-center space-x-2 mb-1 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <span className={`text-sm font-medium ${isOwnMessage ? 'text-blue-300' : 'text-white'}`}>
                        {isOwnMessage ? 'You' : username}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    
                    <div className={`inline-block p-3 rounded-lg max-w-full break-words ${
                      isOwnMessage 
                        ? 'bg-blue-600 text-white rounded-br-sm' 
                        : 'bg-gray-700 text-gray-200 rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">
                        {messageContent}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-gray-700 p-3 bg-gray-800 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
            maxLength={5000}
            disabled={loading || sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || loading || sending}
            className="bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[48px]"
          >
            {sending ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        <div className="text-xs text-gray-500 mt-2 text-center">
          {sending ? 'Sending message...' : `${5000 - newMessage.length} characters remaining`}
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-600 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-white text-lg font-medium">Clear Chat for Everyone</h3>
            </div>
            
            <p className="text-gray-300 mb-6">
              Are you sure you want to clear all messages? This will permanently delete the chat history for <strong>ALL users</strong> in this {projectId ? 'project' : 'room'}.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearChat}
                disabled={clearing}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {clearing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Clear for Everyone</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;