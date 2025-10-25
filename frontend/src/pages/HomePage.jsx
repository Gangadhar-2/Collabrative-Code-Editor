import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import RoomManager from '../components/Room/RoomManager';
import {
  Code,
  Play,
  Users,
  MessageCircle,
  Files,
  Zap,
  Globe,
  Lock,
  LogOut,
  Sparkles,
  Plus,
  LogIn,
  Loader,
  Home,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const HomePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userWorkspace, setUserWorkspace] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(null);

  useEffect(() => {
    initializeUserWorkspace();
  }, []);

  const initializeUserWorkspace = async () => {
    try {
      setLoadingWorkspace(true);
      setWorkspaceError(null);
      
      try {
        const response = await apiService.getUserWorkspace();
        if (response.success) {
          console.log('Found existing workspace:', response.data.room.roomId);
          setUserWorkspace(response.data.room);
          return;
        }
      } catch (error) {
        console.log('No existing workspace found, creating new one...');
      }
      
      const response = await apiService.initializeWorkspace();
      if (response.success) {
        console.log('Workspace initialized:', response.data.room.roomId);
        setUserWorkspace(response.data.room);
        showToast('Welcome! Your persistent workspace is ready.', 'success');
      } else {
        throw new Error(response.message || 'Failed to initialize workspace');
      }
    } catch (error) {
      console.error('Error initializing workspace:', error);
      setWorkspaceError('Failed to initialize workspace');
      showToast('Failed to initialize your workspace. Please try refreshing the page.', 'error');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const handleQuickStart = () => {
    if (!userWorkspace) {
      if (workspaceError) {
        initializeUserWorkspace();
      } else {
        showToast('Workspace not ready yet, please wait...', 'info');
      }
      return;
    }
    
    console.log('Navigating to workspace:', userWorkspace.roomId);
    navigate(`/editor/${userWorkspace.roomId}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const showToast = (message, type = 'info') => {
    const toastId = toast[type](message, {
      duration: 3000,
      position: 'top-right'
    });
    setTimeout(() => toast.dismiss(toastId), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <header className="p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Code className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CodeCollab</h1>
              <p className="text-purple-200 text-sm">Collaborative Code Editor</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-white">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden md:block">
                <span className="block">{user?.username}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-200 hover:text-red-100 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <Sparkles className="w-8 h-8 text-yellow-300" />
            <h2 className="text-5xl md:text-7xl font-bold text-white">
              Code Together
            </h2>
            <Sparkles className="w-8 h-8 text-yellow-300" />
          </div>
          <p className="text-xl md:text-2xl text-purple-100 mb-8 max-w-3xl mx-auto">
            Real-time collaborative code editor with instant execution, live chat,
            and seamless file management. Your workspace never changes!
          </p>
          
          <div className="flex flex-col items-center space-y-4">
            <button
              onClick={handleQuickStart}
              disabled={loadingWorkspace}
              className="group bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-2xl"
            >
              {loadingWorkspace ? (
                <div className="flex items-center space-x-3">
                  <Loader className="w-6 h-6 animate-spin" />
                  <span>Setting up workspace...</span>
                </div>
              ) : workspaceError ? (
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-6 h-6" />
                  <span>Retry Setup</span>
                </div>
              ) : userWorkspace ? (
                <div className="flex items-center space-x-3">
                  <Home className="w-6 h-6" />
                  <Code className="w-6 h-6" />
                  <span>Enter My Workspace</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Play className="w-6 h-6" />
                  <Code className="w-6 h-6" />
                  <span>Start Coding</span>
                </div>
              )}
            </button>
            
            {userWorkspace && (
              <div className="text-center">
                <p className="text-purple-200 text-sm mb-2">
                  Your persistent workspace: 
                  <span className="font-mono bg-purple-800/30 px-2 py-1 rounded ml-1">
                    {userWorkspace.roomId}
                  </span>
                </p>
                <p className="text-purple-300 text-xs">
                  This Room ID never changes - your files and collaborators will always be here
                </p>
              </div>
            )}
            
            {workspaceError && (
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 max-w-md">
                <div className="flex items-center space-x-2 text-red-300">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{workspaceError}</span>
                </div>
                <button
                  onClick={initializeUserWorkspace}
                  className="mt-2 text-xs text-red-200 hover:text-red-100 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-16">
          <RoomManager
            userDefaultRoom={userWorkspace}
            onRoomCreated={(room) => {
              console.log('New room created:', room.roomId);
              showToast(`Room "${room.name}" created successfully!`, 'success');
            }}
          />
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-16">
          <h3 className="text-2xl font-bold text-white text-center mb-8">How Your Persistent Workspace Works</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-purple-300" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Your Permanent Workspace</h4>
              <p className="text-purple-100 text-sm">
                Every user gets a permanent workspace with a Room ID that never changes. Your files, 
                chat history, and progress are always saved here.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-blue-300" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Additional Collaboration Rooms</h4>
              <p className="text-purple-100 text-sm">
                Create separate rooms for different projects or teams. Each room maintains its own 
                files and chat, perfect for organizing multiple collaborations.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-green-300" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Join Others' Rooms</h4>
              <p className="text-purple-100 text-sm">
                Collaborate by joining others' rooms using their Room ID. All rooms persist - 
                you can always return to continue where you left off.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-purple-300" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Real-time Collaboration</h3>
            <p className="text-purple-100">
              Work together with your team in real-time. See everyone's cursors, edits, and changes instantly.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-300" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Instant Code Execution</h3>
            <p className="text-purple-100">
              Execute code in JavaScript, Python, Java, C++, and C with real-time output display.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6 text-green-300" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Persistent Chat & Files</h3>
            <p className="text-purple-100">
              Your conversations and files never disappear. Everything is saved in your persistent workspace.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-4">
              <Files className="w-6 h-6 text-orange-300" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">File Management</h3>
            <p className="text-purple-100">
              Create, edit, rename, and delete files and folders. Full project organization with auto-save.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-indigo-300" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Easy Sharing</h3>
            <p className="text-purple-100">
              Share your workspace ID with anyone. Your room never changes, so collaborators can always return.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-pink-300" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Secure & Private</h3>
            <p className="text-purple-100">
              Your code is secure with JWT authentication and optional private rooms with access codes.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">∞</div>
            <div className="text-purple-200">Persistent Workspaces</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">5+</div>
            <div className="text-purple-200">Programming Languages</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-2">24/7</div>
            <div className="text-purple-200">Always Available</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;