import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { 
  Users, 
  Plus, 
  Copy, 
  Share, 
  Code, 
  Globe, 
  Lock, 
  Home,
  AlertCircle,
  Loader,
  LogIn,
  Trash2,
  MoreVertical
} from 'lucide-react';
import toast from 'react-hot-toast';

const RoomManager = ({ onRoomSelect, currentRoomId, userDefaultRoom, onRoomCreated }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [userRooms, setUserRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  
  const [newRoomData, setNewRoomData] = useState({
    name: '',
    description: '',
    isPrivate: false
  });
  
  const [joinRoomData, setJoinRoomData] = useState({
    roomId: ''
  });

  useEffect(() => {
    loadUserRooms();
  }, []);

  const loadUserRooms = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRooms();
      
      if (response.success) {
        const filteredRooms = response.data.rooms.filter(room => {

          if (room.isWorkspace) return false;
          
          const isOwner = room.owner._id === user._id || room.owner === user._id;
          
          const isParticipant = room.participants?.some(p => {
            const participantId = typeof p.user === 'object' ? p.user._id : p.user;
            return participantId === user._id;
          });
          
          return isOwner || isParticipant;
        });
        
        filteredRooms.sort((a, b) => new Date(b.lastActivity || b.createdAt) - new Date(a.lastActivity || a.createdAt));
        
        console.log(`Loaded ${filteredRooms.length} additional rooms for user ${user.username}`);
        setUserRooms(filteredRooms);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      showToast('Failed to load rooms', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomData.name.trim()) {
      showToast('Room name is required', 'error');
      return;
    }

    setCreating(true);
    try {
      const response = await apiService.createRoom({
        ...newRoomData,
        name: newRoomData.name.trim(),
        description: newRoomData.description.trim()
      });

      if (response.success) {
        const newRoom = response.data.room;
        showToast(`Room "${newRoom.name}" created successfully!`, 'success');
        
        const roomWithOwner = {
          ...newRoom,
          owner: { _id: user._id, username: user.username },
          participants: [],
          activeParticipants: []
        };
        setUserRooms(prev => [roomWithOwner, ...prev]);
        
        setShowCreateModal(false);
        setNewRoomData({ name: '', description: '', isPrivate: false });
        
        if (onRoomCreated) {
          onRoomCreated(newRoom);
        }
        
        showToast(
          `Room created! Share your Room ID: ${newRoom.roomId}`,
          'success'
        );
      } else {
        showToast(response.message || 'Failed to create room', 'error');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      showToast('Failed to create room', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinRoomData.roomId.trim()) {
      showToast('Room ID is required', 'error');
      return;
    }

    setJoining(true);
    try {
      const response = await apiService.joinRoom(joinRoomData.roomId.trim());

      if (response.success) {
        showToast('Joined room successfully!', 'success');
        setShowJoinModal(false);
        setJoinRoomData({ roomId: '' });
        
        await loadUserRooms();
        
        navigate(`/editor/${joinRoomData.roomId.trim()}`);
        
        if (onRoomSelect) {
          onRoomSelect(joinRoomData.roomId.trim());
        }
      } else {
        showToast(response.message || 'Failed to join room', 'error');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      if (error.response?.status === 404) {
        showToast('Room not found. Please check the Room ID.', 'error');
      } else {
        showToast('Failed to join room', 'error');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteRoom = (room) => {
    const isOwner = room.owner._id === user._id || room.owner === user._id;
    
    if (!isOwner) {
      showToast('Only the room owner can delete this room', 'error');
      return;
    }
    
    setRoomToDelete(room);
    setShowDeleteConfirm(true);
    setActiveMenu(null);
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;

    setDeleting(true);
    try {
      console.log(`Deleting room: ${roomToDelete.name} (${roomToDelete.roomId})`);
      
      const response = await apiService.deleteRoom(roomToDelete.roomId);
      
      if (response.success) {
        showToast(`Room "${roomToDelete.name}" deleted successfully`, 'success');
        
        setUserRooms(prev => prev.filter(r => r.roomId !== roomToDelete.roomId));
        
        setShowDeleteConfirm(false);
        setRoomToDelete(null);
        
        console.log(`Successfully deleted room ${roomToDelete.roomId}`);
      } else {
        showToast(response.message || 'Failed to delete room', 'error');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      showToast(error.response?.data?.message || 'Failed to delete room', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const copyRoomId = (roomId) => {
    navigator.clipboard.writeText(roomId);
    showToast('Room ID copied to clipboard!', 'success');
  };

  const shareRoom = (room) => {
    const shareText = `Join my coding room on CodeCollab!\n\nRoom Name: ${room.name}\nRoom ID: ${room.roomId}\n\nJoin at: ${window.location.origin}/editor/${room.roomId}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Join ${room.name} on CodeCollab`,
        text: shareText,
        url: `${window.location.origin}/editor/${room.roomId}`
      });
    } else {
      navigator.clipboard.writeText(shareText);
      showToast('Room details copied to clipboard!', 'success');
    }
  };

  const showToast = (message, type = 'info') => {
    const toastId = toast[type](message, {
      duration: 3000,
      position: 'top-right'
    });
    setTimeout(() => toast.dismiss(toastId), 3000);
  };

  const isRoomOwner = (room) => {
    return room.owner._id === user._id || room.owner === user._id;
  };

  return (
    <div className="bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">My Rooms</h2>
            <p className="text-gray-400">Your workspace and collaboration rooms</p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Join Room</span>
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </button>
          </div>
        </div>

  
        {userDefaultRoom && (
          <div className="bg-gradient-to-r from-purple-800/50 to-blue-800/50 border border-purple-600/50 rounded-lg p-6 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <Home className="w-6 h-6 text-purple-300" />
                  <h3 className="text-xl font-bold text-white">My Workspace</h3>
                </div>
                <p className="text-purple-100 mb-4">
                  Your personal workspace. Files persist forever and collaborators can always find you here.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-purple-300">Room ID:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="bg-purple-900/50 px-2 py-1 rounded text-purple-200">{userDefaultRoom.roomId}</code>
                      <button
                        onClick={() => copyRoomId(userDefaultRoom.roomId)}
                        className="text-purple-300 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-purple-300">Status:</span>
                    <p className="text-green-400 font-medium mt-1">Always Available</p>
                  </div>
                  <div>
                    <span className="text-purple-300">Visibility:</span>
                    <p className="text-blue-400 font-medium mt-1">
                      {userDefaultRoom.isPrivate ? 'Private' : 'Public'}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/editor/${userDefaultRoom.roomId}`)}
                className="ml-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Code className="w-5 h-5" />
                <span>Enter Workspace</span>
              </button>
            </div>
          </div>
        )}

      
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Additional Rooms</span>
          </h3>
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : userRooms.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center border-2 border-dashed border-gray-600">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-white mb-2">No additional rooms</h4>
              <p className="text-gray-400 mb-4">
                Create rooms for different projects or join others' rooms to collaborate.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Room</span>
                </button>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Join Room</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userRooms.map((room) => {
                const isOwner = isRoomOwner(room);
                
                return (
                  <div key={room.roomId} className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-lg font-semibold text-white truncate">{room.name}</h4>
                          {room.isPrivate ? (
                            <Lock className="w-4 h-4 text-yellow-400" />
                          ) : (
                            <Globe className="w-4 h-4 text-green-400" />
                          )}
                          {isOwner && (
                            <span className="bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded text-xs">
                              Owner
                            </span>
                          )}
                        </div>
                        {room.description && (
                          <p className="text-gray-400 text-sm mb-2 line-clamp-2">{room.description}</p>
                        )}
                      </div>
                  
                      {isOwner && (
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === room.roomId ? null : room.roomId)}
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {activeMenu === room.roomId && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setActiveMenu(null)}
                              />
                              <div className="absolute right-0 top-8 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-20 w-40">
                                <button
                                  onClick={() => handleDeleteRoom(room)}
                                  className="w-full text-left px-3 py-2 text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Delete Room</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Room ID:</span>
                        <div className="flex items-center space-x-1">
                          <code className="bg-gray-700 px-2 py-1 rounded text-purple-300 text-xs">{room.roomId}</code>
                          <button
                            onClick={() => copyRoomId(room.roomId)}
                            className="text-gray-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Active Users:</span>
                        <span className="text-green-400">{room.activeParticipants?.length || 0}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => navigate(`/editor/${room.roomId}`)}
                        className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg transition-colors ${
                          currentRoomId === room.roomId
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                        }`}
                      >
                        <Code className="w-4 h-4" />
                        <span>{currentRoomId === room.roomId ? 'Current' : 'Enter'}</span>
                      </button>
                      
                      <button
                        onClick={() => shareRoom(room)}
                        className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
                        title="Share Room"
                      >
                        <Share className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-blue-300 font-semibold mb-1">Privacy Note</h4>
              <p className="text-blue-100 text-sm">
                Only YOU can see your rooms listed here. Others cannot see your workspace or rooms unless you share the Room ID with them. Once you leave a room, you can rejoin anytime using the Room ID.
              </p>
            </div>
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-600 shadow-2xl">
              <h3 className="text-white text-xl font-semibold mb-4">Create New Room</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Room Name *</label>
                  <input
                    type="text"
                    value={newRoomData.name}
                    onChange={(e) => setNewRoomData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="My Coding Room"
                    maxLength={50}
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Description</label>
                  <textarea
                    value={newRoomData.description}
                    onChange={(e) => setNewRoomData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    placeholder="What are you working on?"
                    rows="3"
                    maxLength={200}
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={newRoomData.isPrivate}
                      onChange={(e) => setNewRoomData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-white font-medium">Private Room</span>
                      <p className="text-gray-400 text-sm">Only people with Room ID can join</p>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewRoomData({ name: '', description: '', isPrivate: false });
                  }}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={creating || !newRoomData.name.trim()}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Room</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showJoinModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-600 shadow-2xl">
              <h3 className="text-white text-xl font-semibold mb-4">Join Room</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Room ID *</label>
                  <input
                    type="text"
                    value={joinRoomData.roomId}
                    onChange={(e) => setJoinRoomData({ roomId: e.target.value })}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter Room ID"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Ask someone to share their Room ID
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinRoomData({ roomId: '' });
                  }}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinRoom}
                  disabled={joining || !joinRoomData.roomId.trim()}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Join Room</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && roomToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 border border-red-600 shadow-2xl">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-white text-lg font-medium">Delete Room</h3>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-300 mb-2">
                  Are you sure you want to delete "<span className="font-medium text-white">{roomToDelete.name}</span>"?
                </p>
                <div className="bg-red-900/20 border border-red-700/30 rounded p-3">
                  <p className="text-red-300 text-sm font-medium mb-1">This action cannot be undone!</p>
                  <p className="text-red-400 text-sm">
                    All files, folders, chat history, and participants will lose access to this room permanently.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setRoomToDelete(null);
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteRoom}
                  disabled={deleting}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Room</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomManager;