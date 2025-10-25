import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useEditor } from '../context/EditorContext';
import { apiService } from '../services/api';
import { compareUserIds, extractUserId } from '../utils/helper';
import CodeEditor from '../components/Editor/CodeEditor';
import FileExplorer from '../components/Editor/FIleExplorer';
import OutputPanel from '../components/Editor/OutputPanel';
import ChatPanel from '../components/Chat/ChatPanel';
import OnlineUsers from '../components/Chat/OnlineUsers';
import ProjectModal from '../components/Project/ProjectModal';
import LoadingSpinner from '../components/Layout/LoadingSpinner';
import ErrorPage from '../components/Layout/ErrorPage';
import SocketDebugger from '../components/debug/socketDebugger';
import {
  Code,
  Copy,
  Users,
  MessageCircle,
  Play,
  ArrowLeft,
  LogOut,
  Plus,
  Square,
  Home,
  DoorOpen,
  Bug
} from 'lucide-react';
import toast from 'react-hot-toast';

const EditorPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { logout, isAuthenticated, user } = useAuth();
  const { joinRoom, leaveRoom, connected, participants, socket } = useSocket();
  const { 
    currentFile, 
    setOutput, 
    setExecuting, 
    isExecuting, 
    clearAll, 
    files, 
    addFile, 
    deleteFile, 
    updateFile, 
    setCurrentFile,
    setFiles
  } = useEditor();
  
  const roomId = params.roomId || null;
  const projectId = params.projectId || null;
  
  console.log('🔍 EditorPage params:', {
    params,
    roomId,
    projectId,
    url: window.location.pathname
  });
  
  const [room, setRoom] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projects, setProjects] = useState([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const isProjectMode = !!projectId;
  const currentId = projectId || roomId;

  const prevFileIdRef = useRef(null);
  const hasJoinedRoomRef = useRef(false);
  const initializationInProgressRef = useRef(false);
  const currentIdRef = useRef(null);
  const cleanupFunctionsRef = useRef([]);

  const uniqueParticipants = useMemo(() => {
    if (!Array.isArray(participants)) {
      return [];
    }

    const participantMap = new Map();
    
    participants.forEach(participant => {
      if (!participant) return;
      
      const userId = participant.user?.id || participant.user?._id || participant.id;
      const username = participant.user?.username || participant.username || 'Unknown';
      
      if (userId && !participantMap.has(userId)) {
        participantMap.set(userId, {
          id: userId,
          user: {
            id: userId,
            username: username
          },
          username: username,
          socketId: participant.socketId,
          role: participant.role,
          joinedAt: participant.joinedAt
        });
      }
    });

    if (user && user._id && user.username) {
      const currentUserId = user._id.toString();
      
      if (!participantMap.has(currentUserId)) {
        participantMap.set(currentUserId, {
          id: currentUserId,
          user: {
            id: currentUserId,
            username: user.username
          },
          username: user.username,
          socketId: socket?.id,
          role: 'owner',
          joinedAt: new Date()
        });
      } else {
        const existing = participantMap.get(currentUserId);
        if (existing && (!existing.username || existing.username === 'Unknown')) {
          participantMap.set(currentUserId, {
            ...existing,
            username: user.username,
            user: {
              id: currentUserId,
              username: user.username
            }
          });
        }
      }
    }
    
    return Array.from(participantMap.values());
  }, [participants, user, socket]);

  useEffect(() => {
    const initialize = async () => {
      if (!isAuthenticated || !user) {
        console.log('⏳ Waiting for authentication...');
        return;
      }

      if (currentIdRef.current === currentId) {
        console.log('⏭️ Already initialized for this room/project');
        return;
      }

      if (initializationInProgressRef.current) {
        console.log('⏳ Initialization already in progress...');
        return;
      }

      initializationInProgressRef.current = true;
      console.log('🚀 Starting initialization:', { roomId, projectId, isProjectMode });

      try {
        setLoading(true);
        setError(null);

        if (currentIdRef.current) {
          console.log('🧹 Cleaning up previous room/project...');
          if (hasJoinedRoomRef.current) {
            leaveRoom();
            hasJoinedRoomRef.current = false;
          }
          clearAll();
        }
        currentIdRef.current = currentId;

        if (isProjectMode) {
          console.log('📦 Loading project:', projectId);
          const projectResponse = await apiService.getProject(projectId);
          
          if (!projectResponse.success) {
            throw new Error(projectResponse.message || 'Project not found');
          }
          
          setProject(projectResponse.data.project);
          console.log('✅ Project loaded:', projectResponse.data.project.name);
          
          const projectRoomId = projectResponse.data.project.room?.roomId;
          if (projectRoomId && connected) {
            console.log('🔌 Joining project room:', projectRoomId);
            await joinRoom(projectRoomId);
            hasJoinedRoomRef.current = true;
          }
        } else {
          console.log('🏠 Loading room:', roomId);
          const roomResponse = await apiService.getRoom(roomId);
          
          if (!roomResponse.success) {
            throw new Error(roomResponse.message || 'Room not found');
          }
          
          setRoom(roomResponse.data.room);
          console.log('✅ Room loaded:', roomResponse.data.room.name);
          
          if (connected) {
            console.log('🔌 Joining room:', roomId);
            await joinRoom(roomId);
            hasJoinedRoomRef.current = true;
          }
        }

        await loadFiles();

        if (!isProjectMode) {
          await loadRoomProjects();
        }

        setLoading(false);
        console.log('✅ Initialization complete');

      } catch (err) {
        console.error('❌ Initialization error:', err);
        setError(err.message || 'Failed to load editor');
        setLoading(false);
      } finally {
        initializationInProgressRef.current = false;
      }
    };

    initialize();

    return () => {
      console.log('🧹 EditorPage cleanup triggered');
      cleanupFunctionsRef.current.forEach(fn => fn());
      cleanupFunctionsRef.current = [];
    };
  }, [currentId, isAuthenticated, user, connected]);

  const loadFiles = async () => {
    try {
      let response;
      
      if (isProjectMode) {
        console.log('📂 Fetching project files:', projectId);
        response = await apiService.getProjectFiles(projectId);
      } else {
        console.log('📂 Fetching room files:', roomId);
        response = await apiService.getRoomFiles(roomId);
      }

      if (response.success) {
        const loadedFiles = (response.data.files || []).map(file => ({
          id: file._id || file.id,
          _id: file._id || file.id,
          name: file.name,
          content: file.content || '',
          language: file.fileType || file.language || 'javascript',
          fileType: file.fileType || file.language || 'javascript',
          type: file.isDirectory ? 'folder' : 'file',
          isDirectory: file.isDirectory || false,
          parent: file.parent || null,
          path: file.path || file.name,
          lastModified: file.lastModified,
          createdAt: file.createdAt,
          projectId: isProjectMode ? projectId : null,
          roomId: !isProjectMode ? roomId : null
        }));

        console.log(`✅ Loaded ${loadedFiles.length} files`);
        setFiles(loadedFiles);

        if (loadedFiles.length > 0 && !currentFile) {
          const firstFile = loadedFiles.find(f => !f.isDirectory);
          if (firstFile) {
            console.log('📄 Auto-selecting first file:', firstFile.name);
            setCurrentFile(firstFile);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading files:', error);
      toast.error('Failed to load files');
    }
  };

  const loadRoomProjects = async () => {
    try {
      console.log('📦 Loading projects for room:', roomId);
      const response = await apiService.getProjects(roomId);
      if (response.success) {
        const projectsList = response.data.projects || [];
        console.log(`✅ Loaded ${projectsList.length} projects for room ${roomId}`);
        setProjects(projectsList);
      }
    } catch (error) {
      console.error('❌ Error loading projects:', error);
    }
  };

  useEffect(() => {
    if (prevFileIdRef.current !== null && prevFileIdRef.current !== currentFile?.id) {
      console.log('📄 File switched, closing output panel');
      setShowOutput(false);
    }
    prevFileIdRef.current = currentFile?.id;
  }, [currentFile?.id]);

  useEffect(() => {
    if (!socket || !connected || !user) {
      return;
    }

    console.log('🔌 Setting up live sync listeners...');

    const handleProjectCreated = (data) => {
      console.log('🔔 PROJECT CREATED EVENT:', data.project?.name);
      
      const projectRoomId = data.project?.room?.roomId;
      const currentRoomId = roomId || project?.room?.roomId;
      
      if (projectRoomId !== currentRoomId) {
        console.log('⏭️ Project created in different room, ignoring');
        return;
      }
      
      if (compareUserIds(data.user?.id, user._id)) {
        console.log('⏭️ Skipping - user is creator');
        return;
      }
      
      const newProject = {
        _id: data.project._id,
        name: data.project.name,
        description: data.project.description,
        owner: data.project.owner,
        primaryLanguage: data.project.primaryLanguage,
        projectType: data.project.projectType,
        framework: data.project.framework,
        isPublic: data.project.isPublic,
        createdAt: data.project.createdAt,
        lastActivity: data.project.lastActivity,
        room: data.project.room
      };
      
      setProjects(prev => {
        const exists = prev.some(p => p._id === newProject._id);
        if (exists) return prev;
        return [newProject, ...prev];
      });
      
      toast.success(`📁 ${data.user?.username} created "${data.project.name}"`, {
        duration: 4000
      });
    };

    const handleProjectDeleted = (data) => {
      console.log('🔔 PROJECT DELETED EVENT:', data.projectName);
      
      setProjects(prev => prev.filter(p => p._id !== data.projectId));
      
      if (data.projectId === projectId) {
        toast.error(`Project "${data.projectName}" was deleted by ${data.deletedByUsername}`, {
          duration: 5000
        });
        
        clearAll();
        setProject(null);
        
        setTimeout(() => {
          if (data.redirectTo?.roomId) {
            navigate(`/editor/${data.redirectTo.roomId}`, { replace: true });
          } else if (user?.defaultWorkspaceRoomId) {
            navigate(`/editor/${user.defaultWorkspaceRoomId}`, { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }, 2000);
      } else if (!compareUserIds(data.deletedBy, user._id)) {
        toast.info(`Project "${data.projectName}" was deleted`);
      }
    };

    const handleFileCreated = (data) => {
      console.log('═══════════════════════════════════════');
      console.log('🔔 FILE CREATED EVENT RECEIVED');
      console.log('═══════════════════════════════════════');
      
      console.log('📥 Event Data:', {
        fileName: data.file?.name,
        eventProjectId: data.projectId,
        eventRoomId: data.roomId,
        fileProjectId: data.file?.projectId,
        fileRoomId: data.file?.roomId
      });
      
      console.log('📍 Current Context:', {
        myProjectId: projectId,
        myRoomId: roomId,
        isProjectMode: isProjectMode,
        currentMode: isProjectMode ? 'PROJECT' : 'WORKSPACE'
      });
      
      const eventProjectId = data.projectId;
      const eventRoomId = data.roomId;
      const fileProjectId = data.file?.projectId;
      const fileRoomId = data.file?.roomId;
      
      const hasBothIds = (fileProjectId && fileRoomId) || (eventProjectId && eventRoomId);
      
      if (hasBothIds) {
        console.log('⚠️ WARNING: File has BOTH projectId AND roomId!', {
          fileProjectId,
          fileRoomId,
          eventProjectId,
          eventRoomId
        });
      }
      
      let shouldAccept = false;
      let rejectionReason = '';
      
      if (isProjectMode) {
        const hasMatchingProject = (eventProjectId === projectId) || (fileProjectId === projectId);
        const hasNoRoom = !eventRoomId && !fileRoomId;
        
        shouldAccept = hasMatchingProject && hasNoRoom;
        
        if (!shouldAccept) {
          if (!hasMatchingProject) {
            rejectionReason = `Project mismatch (want: ${projectId}, got event: ${eventProjectId}, file: ${fileProjectId})`;
          } else if (!hasNoRoom) {
            rejectionReason = `File has roomId (event: ${eventRoomId}, file: ${fileRoomId}) - workspace files not allowed in project mode`;
          }
        }
        
        console.log('🔍 Project Mode Check:', {
          hasMatchingProject,
          hasNoRoom,
          shouldAccept,
          rejectionReason: rejectionReason || 'N/A'
        });
        
      } else {
        const hasMatchingRoom = (eventRoomId === roomId) || (fileRoomId === roomId);
        const hasNoProject = !eventProjectId && !fileProjectId;
        
        shouldAccept = hasMatchingRoom && hasNoProject;
        
        if (!shouldAccept) {
          if (!hasMatchingRoom) {
            rejectionReason = `Room mismatch (want: ${roomId}, got event: ${eventRoomId}, file: ${fileRoomId})`;
          } else if (!hasNoProject) {
            rejectionReason = `File has projectId (event: ${eventProjectId}, file: ${fileProjectId}) - project files not allowed in workspace mode`;
          }
        }
        
        console.log('🔍 Workspace Mode Check:', {
          hasMatchingRoom,
          hasNoProject,
          shouldAccept,
          rejectionReason: rejectionReason || 'N/A'
        });
      }
      
      if (!shouldAccept) {
        console.log('❌ REJECTED FILE');
        console.log('Reason:', rejectionReason);
        console.log('═══════════════════════════════════════\n');
        return;
      }
      
      console.log('✅ ACCEPTED FILE - Adding to state');
      
      const newFile = {
        id: data.file._id || data.file.id,
        _id: data.file._id || data.file.id,
        name: data.file.name,
        content: data.file.content || '',
        language: data.file.fileType || data.file.language || 'javascript',
        fileType: data.file.fileType || data.file.language || 'javascript',
        type: data.file.isDirectory ? 'folder' : 'file',
        isDirectory: data.file.isDirectory || false,
        parent: data.file.parent,
        path: data.file.path || data.file.name,
        lastModified: data.file.lastModified,
        createdAt: data.file.createdAt,
        projectId: isProjectMode ? projectId : null,
        roomId: !isProjectMode ? roomId : null
      };
      
      console.log('📝 Adding file to state:', {
        fileName: newFile.name,
        fileProjectId: newFile.projectId,
        fileRoomId: newFile.roomId
      });
      
      addFile(newFile);
      
      if (!compareUserIds(data.user?.id, user._id)) {
        toast.success(`📄 ${data.user?.username} created "${data.file.name}"`);
      }
      
      console.log('═══════════════════════════════════════\n');
    };

    const handleFileDeleted = (data) => {
      console.log('🔔 FILE DELETED EVENT:', data.fileName);
      
      const belongsToCurrentView = 
        (isProjectMode && data.projectId === projectId) ||
        (!isProjectMode && data.roomId === roomId);
      
      if (!belongsToCurrentView) return;
      
      deleteFile(data.fileId);
      
      if (currentFile && currentFile.id === data.fileId) {
        setCurrentFile(null);
      }
      
      if (!compareUserIds(data.user?.id, user._id)) {
        toast.info(`🗑️ ${data.user?.username} deleted "${data.fileName}"`);
      }
    };

    const handleFileRenamed = (data) => {
      console.log('🔔 FILE RENAMED EVENT:', data.newName);
      
      const belongsToCurrentView = 
        (isProjectMode && data.projectId === projectId) ||
        (!isProjectMode && data.roomId === roomId);
      
      if (!belongsToCurrentView) return;
      
      updateFile({ id: data.fileId, name: data.newName });
      
      if (currentFile && currentFile.id === data.fileId) {
        setCurrentFile({ ...currentFile, name: data.newName });
      }
      
      if (!compareUserIds(data.user?.id, user._id)) {
        toast.info(`✏️ ${data.user?.username} renamed "${data.oldName}" to "${data.newName}"`);
      }
    };

    socket.on('project-created', handleProjectCreated);
    socket.on('project-deleted', handleProjectDeleted);
    socket.on('file-created', handleFileCreated);
    socket.on('file-deleted', handleFileDeleted);
    socket.on('file-renamed', handleFileRenamed);
    
    console.log('✅ All live sync listeners registered');

    const cleanup = () => {
      socket.off('project-created', handleProjectCreated);
      socket.off('project-deleted', handleProjectDeleted);
      socket.off('file-created', handleFileCreated);
      socket.off('file-deleted', handleFileDeleted);
      socket.off('file-renamed', handleFileRenamed);
      console.log('🧹 Socket listeners cleaned up');
    };

    cleanupFunctionsRef.current.push(cleanup);

    return cleanup;
  }, [socket, connected, projectId, roomId, isProjectMode, user]);

  useEffect(() => {
    if (!currentFile) return;
    
    console.log('🔍 Validating currentFile belongs to current context:', {
      fileName: currentFile.name,
      fileProjectId: currentFile.projectId,
      fileRoomId: currentFile.roomId,
      myProjectId: projectId,
      myRoomId: roomId,
      isProjectMode: isProjectMode
    });
    
    let belongsToCurrentContext = false;
    
    if (isProjectMode) {
      belongsToCurrentContext = (
        currentFile.projectId === projectId && 
        currentFile.projectId !== null &&
        currentFile.projectId !== undefined &&
        !currentFile.roomId
      );
    } else {
      belongsToCurrentContext = (
        currentFile.roomId === roomId && 
        currentFile.roomId !== null &&
        currentFile.roomId !== undefined &&
        !currentFile.projectId
      );
    }
    
    if (!belongsToCurrentContext) {
      console.log('❌ currentFile does NOT belong to current context - CLEARING');
      console.log('Reason:', isProjectMode 
        ? `Project mode expects projectId=${projectId} with no roomId, but file has projectId=${currentFile.projectId} and roomId=${currentFile.roomId}`
        : `Workspace mode expects roomId=${roomId} with no projectId, but file has roomId=${currentFile.roomId} and projectId=${currentFile.projectId}`
      );
      setCurrentFile(null);
    } else {
      console.log('✅ currentFile belongs to current context');
    }
  }, [currentFile, projectId, roomId, isProjectMode, setCurrentFile]);

  useEffect(() => {
    if (!socket || !connected || !projectId || !user) {
      return;
    }

    console.log('🔌 Joining project socket room:', `project-${projectId}`);
    
    socket.emit('join-project', {
      projectId: projectId,
      userId: user._id,
      username: user.username
    });

    return () => {
      console.log('🧹 Leaving project socket room');
      socket.emit('leave-project', {
        projectId: projectId,
        userId: user._id,
        username: user.username
      });
    };
  }, [socket, connected, projectId, user]);

  const handleRunCode = async () => {
    if (!currentFile) {
      toast.error('No file selected');
      return;
    }

    if (!currentFile.content || !currentFile.content.trim()) {
      toast.error('File is empty');
      return;
    }

    try {
      setExecuting(true);
      setShowOutput(true);
      
      console.log('▶️ Executing code:', {
        file: currentFile.name,
        language: currentFile.language,
        roomId
      });

      const response = await apiService.executeCode({
        code: currentFile.content,
        language: currentFile.language || 'javascript',
        stdin: '',
        roomId: roomId
      });

      if (response.success) {
        setOutput({
          output: response.data.output || '',
          error: response.data.error || null,
          executionTime: response.data.executionTime,
          exitCode: response.data.exitCode
        });
        
        console.log('✅ Code executed successfully');
      } else {
        setOutput({
          output: '',
          error: response.message || 'Execution failed',
          executionTime: 0,
          exitCode: 1
        });
      }
    } catch (error) {
      console.error('❌ Execution error:', error);
      setOutput({
        output: '',
        error: error.message || 'Failed to execute code',
        executionTime: 0,
        exitCode: 1
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyRoomId = () => {
    const idToCopy = roomId || project?.room?.roomId;
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      toast.success('Room ID copied!', { duration: 2000 });
    }
  };

  const handleLeaveRoom = () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveRoom = async () => {
    try {
      setShowLeaveConfirm(false);
      
      if (roomId) {
        await leaveRoom(roomId);
        await apiService.leaveRoom(roomId);
      }
      
      toast.success('Left room successfully');
      
      if (user?.defaultWorkspaceRoomId) {
        navigate(`/editor/${user.defaultWorkspaceRoomId}`);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Error leaving room:', error);
      toast.error('Failed to leave room');
    }
  };

  const handleLogout = () => {
    if (roomId) {
      leaveRoom(roomId);
    }
    logout();
    navigate('/login');
  };

  if (loading) {
    return <LoadingSpinner message="Loading editor..." />;
  }

  if (error) {
    return <ErrorPage message={error} />;
  }

  const isJoinedRoom = roomId && connected && hasJoinedRoomRef.current;
  const displayRoomId = roomId || project?.room?.roomId || 'N/A';
  const displayName = project?.name || room?.name || 'Untitled';

  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">
      <SocketDebugger />
      
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex-shrink-0 relative z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Home"
            >
              <Home className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <Code className="w-6 h-6 text-purple-400" />
              <div>
                <h1 className="text-white font-semibold text-lg">
                  {displayName}
                </h1>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">
                    Room: {displayRoomId}
                  </span>
                  {isJoinedRoom && (
                    <span className="flex items-center space-x-1 text-xs">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-green-300">Connected</span>
                    </span>
                  )}
                </div>
              </div>
              
              <button
                onClick={handleCopyRoomId}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                title="Copy Room ID"
              >
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Copy ID</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowProjectModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>

            <button
              onClick={handleRunCode}
              disabled={!currentFile || isExecuting}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span className="hidden sm:inline">Run Code</span>
                </>
              )}
            </button>

            {showOutput && (
              <button
                onClick={() => setShowOutput(false)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                <Square className="w-4 h-4" />
                <span className="hidden sm:inline">Hide Output</span>
              </button>
            )}

            {((isJoinedRoom && !room?.isWorkspace) || isProjectMode) && (
              <button
                onClick={handleLeaveRoom}
                className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
                title="Leave Room"
              >
                <DoorOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-200 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex-shrink-0 relative z-20">
          <FileExplorer 
            roomId={roomId}
            projectId={projectId}
            projectName={project?.name}
            projects={projects}
            setProjects={setProjects}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <div 
            className="bg-gray-900" 
            style={{ 
              flex: showOutput ? '1 1 auto' : '1 1 100%',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <CodeEditor roomId={roomId} projectId={projectId} />
          </div>
          
          {showOutput && (
            <div 
              className="border-t border-gray-700 bg-gray-900 relative z-15"
              style={{ 
                height: '256px',
                flexShrink: 0,
                flexGrow: 0
              }}
            >
              <OutputPanel />
            </div>
          )}
        </div>

        {(showChat || showUsers) && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0 relative z-25">
            {showUsers && !showChat && (
              <div className="flex-1 min-h-0">
                <OnlineUsers 
                  participants={uniqueParticipants}
                  onClose={() => setShowUsers(false)}
                />
              </div>
            )}
            {showChat && !showUsers && (
              <div className="flex-1 min-h-0">
                <ChatPanel 
                  roomId={roomId}
                  projectId={projectId}
                  onClose={() => setShowChat(false)}
                />
              </div>
            )}
            {showChat && showUsers && (
              <>
                <div className="h-1/2 border-b border-gray-700">
                  <OnlineUsers 
                    participants={uniqueParticipants}
                    onClose={() => setShowUsers(false)}
                  />
                </div>
                <div className="h-1/2">
                  <ChatPanel 
                    roomId={roomId}
                    projectId={projectId}
                    onClose={() => setShowChat(false)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!showChat && !showUsers && !showOutput && (
        <div className="fixed bottom-4 right-4 flex flex-col space-y-2 z-40">
          <button
            onClick={() => setShowUsers(true)}
            className="p-3 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 bg-green-600 hover:bg-green-700 text-white"
            title="Show Online Users"
          >
            <div className="relative">
              <Users className="w-5 h-5" />
              {uniqueParticipants.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {uniqueParticipants.length}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => setShowChat(true)}
            className="p-3 rounded-full shadow-lg transition-all duration-200 transform hover:scale-105 bg-purple-600 hover:bg-purple-700 text-white"
            title="Open Chat"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-600 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                <DoorOpen className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-white text-lg font-medium">Leave Room</h3>
            </div>
            
            <p className="text-gray-300 mb-6">
              Are you sure you want to leave this room? You can rejoin anytime using the Room ID.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeaveRoom}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
              >
                <DoorOpen className="w-4 h-4" />
                <span>Leave Room</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showProjectModal && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          onProjectCreated={(newProject) => {
            console.log('New project created:', newProject._id);
            setShowProjectModal(false);
            setProjects(prev => [newProject, ...prev]);
            toast.success(`Project "${newProject.name}" created!`);
            navigate(`/project/${newProject._id}`);
          }}
          roomId={roomId}
        />
      )}
    </div>
  );
};

export default EditorPage;