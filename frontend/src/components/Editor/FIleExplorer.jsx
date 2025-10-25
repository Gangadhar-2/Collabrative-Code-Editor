import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import LanguageSelector from './LanguageSelector';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  File, 
  Folder, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  FolderPlus,
  X,
  Check,
  FileText,
  Search,
  Loader,
  Briefcase,
  AlertTriangle,
  Eye,
  EyeOff,
  Home
} from 'lucide-react';
import toast from 'react-hot-toast';

const FileExplorer = ({ roomId, projectId, projectName, projects, setProjects }) => {
  const { files, setFiles, currentFile, setCurrentFile, addFile, deleteFile, updateFile } = useEditor();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const roomIdRef = useRef(roomId);
  const projectIdRef = useRef(projectId);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('file');
  const [newName, setNewName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showProjectActions, setShowProjectActions] = useState(false);
  
  const [viewMode, setViewMode] = useState(projectId ? 'project' : 'workspace');
  const [lastWorkspaceFile, setLastWorkspaceFile] = useState(null);

  useEffect(() => {
    if (roomId) {
      roomIdRef.current = roomId;
      console.log('✅ roomId updated in ref:', roomId);
    }
    if (projectId) {
      projectIdRef.current = projectId;
      console.log('✅ projectId updated in ref:', projectId);
    }
  }, [roomId, projectId]);

  useEffect(() => {
    console.log('📦 FileExplorer Props:', {
      roomId,
      projectId,
      roomIdRef: roomIdRef.current,
      projectIdRef: projectIdRef.current,
      viewMode,
      selectedProjectId,
      currentPath: location.pathname
    });
  }, [roomId, projectId, viewMode, selectedProjectId, location.pathname]);

  useEffect(() => {
    if (viewMode === 'project' && selectedProjectId) {
      loadProjectFiles(selectedProjectId);
    } else if (viewMode === 'workspace' && roomIdRef.current) {
      loadRoomFiles();
    }
  }, [viewMode, selectedProjectId]);

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
      setViewMode('project');
    } else if (roomId) {
      setViewMode('workspace');
    }
  }, [projectId, roomId]);

  useEffect(() => {
    if (currentFile) {
      let belongsToCurrentMode = false;
      
      if (viewMode === 'workspace') {
        belongsToCurrentMode = (
          currentFile.roomId === roomIdRef.current && 
          !currentFile.projectId
        );
      } else if (viewMode === 'project' && selectedProjectId) {
        belongsToCurrentMode = (
          currentFile.projectId === selectedProjectId && 
          !currentFile.roomId
        );
      }
      
      if (!belongsToCurrentMode) {
        console.log('🧹 Clearing currentFile - wrong mode');
        setCurrentFile(null);
      }
    }
  }, [viewMode, selectedProjectId, currentFile, setCurrentFile]);

  const loadProjectFiles = async (projId) => {
    if (!projId) return;
    
    try {
      setLoading(true);
      const response = await apiService.getProjectFiles(projId);
      if (response.success) {
        const filesData = response.data.files || [];
        const formattedFiles = filesData.map(file => ({
          id: file._id || file.id,
          name: file.name,
          content: file.content || '',
          language: file.fileType || file.language || 'javascript',
          type: file.isDirectory ? 'folder' : 'file',
          isDirectory: file.isDirectory,
          parent: file.parent,
          path: file.path,
          lastModified: file.lastModified,
          createdAt: file.createdAt,
          projectId: projId,
          roomId: null
        }));
        
        console.log(`✅ Loaded ${formattedFiles.length} files from project ${projId}`);
        setFiles(formattedFiles);
      }
    } catch (error) {
      console.error('Error loading project files:', error);
      showToast('Failed to load project files', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRoomFiles = async () => {
    const currentRoomId = roomIdRef.current;
    if (!currentRoomId) {
      console.error('❌ Cannot load room files - no roomId');
      return;
    }
    
    try {
      setLoading(true);
      console.log('📂 Loading files for room:', currentRoomId);
      const response = await apiService.getRoomFiles(currentRoomId);
      if (response.success) {
        const filesData = response.data.files || [];
        const formattedFiles = filesData.map(file => ({
          id: file._id || file.id,
          name: file.name,
          content: file.content || '',
          language: file.fileType || file.language || 'javascript',
          type: file.isDirectory ? 'folder' : 'file',
          isDirectory: file.isDirectory,
          parent: file.parent,
          roomId: currentRoomId,
          projectId: null
        }));
        
        console.log(`✅ Loaded ${formattedFiles.length} files from workspace ${currentRoomId}`);
        setFiles(formattedFiles);
        
        if (lastWorkspaceFile) {
          const fileExists = formattedFiles.find(f => f.id === lastWorkspaceFile.id);
          if (fileExists) {
            setCurrentFile(fileExists);
          } else {
            setCurrentFile(null);
          }
        } else {
          setCurrentFile(null);
        }
      }
    } catch (error) {
      console.error('Error loading room files:', error);
      showToast('Failed to load room files', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projId) => {
    console.log('═══════════════════════════════════════');
    console.log('🎯 PROJECT SELECT CLICKED');
    console.log('Project ID:', projId);
    console.log('Current selected:', selectedProjectId);
    console.log('Current URL:', window.location.pathname);
    console.log('Will navigate to:', `/project/${projId}`);
    console.log('═══════════════════════════════════════');
    
    if (projId !== selectedProjectId) {
      setSelectedProjectId(projId);
      setCurrentFile(null);
      setViewMode('project');
      
      navigate(`/project/${projId}`);
      
      setTimeout(() => {
        console.log('✅ After navigate, URL is:', window.location.pathname);
        if (!window.location.pathname.includes(projId)) {
          console.error('❌ Navigation failed! URL did not change!');
          showToast('Navigation failed. Please refresh.', 'error');
        }
      }, 100);
    }
  };

  const handleWorkspaceSwitch = () => {
    console.log('🏠 Switching to workspace');
    console.log('Current roomId:', roomIdRef.current);
    
    setViewMode('workspace');
    setSelectedProjectId(null);
    loadRoomFiles();
    
    if (roomIdRef.current) {
      const targetUrl = `/editor/${roomIdRef.current}`;
      console.log('Navigating to:', targetUrl);
      navigate(targetUrl);
    } else {
      console.error('❌ No roomId available for workspace switch!');
      showToast('Cannot switch to workspace - no room ID', 'error');
    }
  };

  const handleDeleteProject = async (projectIdToDelete) => {
    const project = projects.find(p => p._id === projectIdToDelete);
    setProjectToDelete(project);
    setShowDeleteConfirm(true);
    setShowProjectActions(false);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    setDeleting(true);
    try {
      const response = await apiService.deleteProject(projectToDelete._id);
      
      if (response.success) {
        showToast(`Project "${projectToDelete.name}" deleted successfully`, 'success');
        setProjects(prev => prev.filter(p => p._id !== projectToDelete._id));
        
        if (selectedProjectId === projectToDelete._id) {
          setSelectedProjectId(null);
          setCurrentFile(null);
          setFiles([]);
        }
        
        setShowDeleteConfirm(false);
        setProjectToDelete(null);
      } else {
        showToast(response.message || 'Failed to delete project', 'error');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      showToast(error.response?.data?.message || 'Failed to delete project', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateFile = async () => {
    if (!newName.trim()) {
      showToast(`${createType === 'file' ? 'File' : 'Folder'} name is required`, 'error');
      return;
    }

    const currentRoomId = roomIdRef.current;
    const currentProjectId = selectedProjectId || projectIdRef.current;

    console.log('🎯 Creating file - checking context:', {
      viewMode,
      currentRoomId,
      currentProjectId,
      roomIdProp: roomId,
      projectIdProp: projectId,
      selectedProjectId,
      currentURL: window.location.pathname
    });

    if (viewMode === 'project') {
      if (!currentProjectId) {
        showToast('Please select a project first', 'error');
        return;
      }
    } else if (viewMode === 'workspace') {
      if (!currentRoomId) {
        console.error('❌ WORKSPACE MODE BUT NO ROOM ID!', {
          viewMode,
          roomIdProp: roomId,
          roomIdRef: roomIdRef.current,
          projectIdProp: projectId
        });
        showToast('Room ID is missing. Please refresh the page.', 'error');
        return;
      }
    }

    try {
      const fileName = createType === 'file' 
        ? `${newName}.${getFileExtension(selectedLanguage)}`
        : newName;

      const newFileData = {
        name: fileName,
        content: createType === 'file' ? getDefaultContent(selectedLanguage) : '',
        fileType: createType === 'file' ? selectedLanguage : undefined,
        isDirectory: createType === 'folder',
        parent: null
      };

      if (viewMode === 'project' && currentProjectId) {
        newFileData.project = currentProjectId;
        console.log('✅ Creating file in PROJECT:', currentProjectId);
      } else if (viewMode === 'workspace' && currentRoomId) {
        newFileData.room = currentRoomId;
        console.log('✅ Creating file in WORKSPACE:', currentRoomId);
      }

      console.log('📤 API request:', newFileData);

      const response = await apiService.createFile(newFileData);
      
      if (response.success && response.data.file) {
        const createdFile = {
          id: response.data.file._id || response.data.file.id,
          name: fileName,
          content: newFileData.content,
          language: selectedLanguage,
          type: createType,
          isDirectory: createType === 'folder',
          parent: null,
          path: `/${fileName}`,
          projectId: viewMode === 'project' ? currentProjectId : null,
          roomId: viewMode === 'workspace' ? currentRoomId : null,
          createdAt: response.data.file.createdAt,
          lastModified: response.data.file.lastModified
        };
        
        console.log('✅ File created:', createdFile);
        
        addFile(createdFile);
        
        if (socket) {
          socket.emit('file-created', {
            file: createdFile,
            projectId: viewMode === 'project' ? currentProjectId : null,
            roomId: viewMode === 'workspace' ? currentRoomId : null,
            user: {
              id: user?._id,
              username: user?.username
            }
          });
          console.log('📤 Socket emitted file-created');
        }
        
        showToast(`${createType === 'file' ? 'File' : 'Folder'} created successfully`, 'success');
        setShowCreateModal(false);
        setNewName('');
        
        if (createType === 'file') {
          setCurrentFile(createdFile);
          if (viewMode === 'workspace') {
            setLastWorkspaceFile(createdFile);
          }
        }
      } else {
        showToast(response.message || 'Failed to create file', 'error');
      }
    } catch (error) {
      console.error('❌ Error creating file:', error);
      showToast(error.response?.data?.message || 'Failed to create file', 'error');
    }
  };

  const handleDeleteFile = async (fileId, fileName) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      try {
        const currentRoomId = roomIdRef.current;
        const params = viewMode === 'workspace' ? { room: currentRoomId } : {};
        await apiService.deleteFile(fileId, params);
        
        deleteFile(fileId);
        if (socket) {
          socket.emit('file-deleted', {
            fileId: fileId,
            fileName: fileName,
            projectId: viewMode === 'project' ? selectedProjectId : null,
            roomId: viewMode === 'workspace' ? currentRoomId : null,
            user: {
              id: user?._id,
              username: user?.username
            }
          });
        }
        
        if (currentFile && currentFile.id === fileId) {
          const remainingFiles = files.filter(f => f.id !== fileId && !f.isDirectory);
          
          if (viewMode === 'workspace' && lastWorkspaceFile?.id === fileId) {
            setLastWorkspaceFile(null);
          }
          
          setCurrentFile(remainingFiles.length > 0 ? remainingFiles[0] : null);
        }
        
        showToast('File deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting file:', error);
        showToast('Failed to delete file', 'error');
      }
    }
  };

  const handleRenameFile = async (fileId) => {
    if (!editName.trim()) {
      showToast('File name cannot be empty', 'error');
      return;
    }

    try {
      const currentRoomId = roomIdRef.current;
      const response = await apiService.renameFile(fileId, { 
        newName: editName, 
        room: viewMode === 'workspace' ? currentRoomId : undefined 
      });
      if (response.success) {
        updateFile({ id: fileId, name: editName });
        
        if (currentFile && currentFile.id === fileId) {
          const updatedFile = { ...currentFile, name: editName };
          setCurrentFile(updatedFile);
          
          if (viewMode === 'workspace' && lastWorkspaceFile?.id === fileId) {
            setLastWorkspaceFile(updatedFile);
          }
        }
        
        showToast('File renamed successfully', 'success');
      } else {
        showToast('Failed to rename file', 'error');
      }
    } catch (error) {
      console.error('Error renaming file:', error);
      showToast('Failed to rename file', 'error');
    }
    
    setEditingId(null);
    setEditName('');
  };

  const handleFileClick = (file) => {
    console.log('🖱️ File clicked:', {
      fileName: file.name,
      fileProjectId: file.projectId,
      fileRoomId: file.roomId,
      currentViewMode: viewMode,
      selectedProjectId: selectedProjectId,
      currentURL: window.location.pathname
    });
    
    const isProjectFile = !!file.projectId && !file.roomId;
    const isWorkspaceFile = !!file.roomId && !file.projectId;
    
    if (viewMode === 'project' && isProjectFile) {
      const fileToSet = {
        ...file,
        projectId: selectedProjectId,
        roomId: null
      };
      
      console.log('✅ Setting project file:', fileToSet);
      setCurrentFile(fileToSet);
      
    } else if (viewMode === 'workspace' && isWorkspaceFile) {
      const fileToSet = {
        ...file,
        roomId: roomIdRef.current,
        projectId: null
      };
      
      console.log('✅ Setting workspace file:', fileToSet);
      setCurrentFile(fileToSet);
      setLastWorkspaceFile(fileToSet);
      
    } else {
      console.error('❌ File context mismatch!', {
        fileProjectId: file.projectId,
        fileRoomId: file.roomId,
        viewMode: viewMode,
        selectedProjectId: selectedProjectId,
        isProjectFile,
        isWorkspaceFile
      });
      
      showToast('File context mismatch. Try switching modes.', 'error');
    }
  };

  const showToast = (message, type = 'info') => {
    const toastId = toast[type](message, {
      duration: 3000,
      position: 'top-right'
    });
    setTimeout(() => toast.dismiss(toastId), 3000);
  };

  const getFileExtension = (language) => {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md'
    };
    return extensions[language] || 'txt';
  };

  const getDefaultContent = (language) => {
    const templates = {
      javascript: '// JavaScript file\nconsole.log("Hello, World!");',
      typescript: '// TypeScript file\nconsole.log("Hello, World!");',
      python: '# Python file\nprint("Hello, World!")',
      java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
      cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
      c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
      html: '<!DOCTYPE html>\n<html>\n<head>\n    <title>Page Title</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
      css: '/* CSS file */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}',
      json: '{\n  "name": "example",\n  "version": "1.0.0"\n}',
      markdown: '# Markdown File\n\nHello, World!'
    };
    return templates[language] || `// ${language} file\n// Start coding here...`;
  };

  const getFileIcon = (file) => {
    if (file.type === 'folder' || file.isDirectory) {
      return <Folder className="w-4 h-4 text-blue-400" />;
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    const iconMap = {
      js: '🟨',
      ts: '🔷',
      py: '🐍',
      java: '☕',
      cpp: '⚡',
      c: '🔧',
      html: '🌐',
      css: '🎨',
      json: '📋',
      md: '📝'
    };
    
    if (iconMap[extension]) {
      return <span className="text-sm">{iconMap[extension]}</span>;
    }
    
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const currentProject = projects?.find(p => p._id === selectedProjectId);
  
  console.log('🔍 ALL FILES IN STATE:', files.map(f => ({
    name: f.name,
    projectId: f.projectId,
    roomId: f.roomId,
    hasProject: !!f.projectId,
    hasRoom: !!f.roomId
  })));

  console.log('🔍 CURRENT FILTER CONTEXT:', {
    viewMode,
    roomIdRef: roomIdRef.current,
    selectedProjectId,
    filesCount: files.length,
    currentURL: location.pathname
  });

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (viewMode === 'workspace') {
      const hasCorrectRoom = file.roomId === roomIdRef.current;
      const hasNoProject = !file.projectId || file.projectId === null || file.projectId === undefined;
      
      const shouldShow = hasCorrectRoom && hasNoProject;
      
      if (!shouldShow) {
        console.log('🚫 Filtering OUT from workspace:', {
          fileName: file.name,
          fileRoomId: file.roomId,
          expectedRoomId: roomIdRef.current,
          fileProjectId: file.projectId,
          reason: !hasCorrectRoom ? 'Wrong/missing roomId' : 'Has projectId (project file in workspace)'
        });
      }
      
      return shouldShow;
    } 
    
    if (viewMode === 'project') {
      const hasCorrectProject = file.projectId === selectedProjectId;
      const hasNoRoom = !file.roomId || file.roomId === null || file.roomId === undefined;
      
      const shouldShow = hasCorrectProject && hasNoRoom;
      
      if (!shouldShow) {
        console.log('🚫 Filtering OUT from project:', {
          fileName: file.name,
          fileProjectId: file.projectId,
          expectedProjectId: selectedProjectId,
          fileRoomId: file.roomId,
          reason: !hasCorrectProject ? 'Wrong/missing projectId' : 'Has roomId (workspace file in project)'
        });
      }
      
      return shouldShow;
    }
    
    return false;
  });

  console.log('✅ FILTERED FILES TO SHOW:', filteredFiles.map(f => ({
    name: f.name,
    projectId: f.projectId,
    roomId: f.roomId
  })));
  console.log(`📊 Showing ${filteredFiles.length} files in ${viewMode} mode`);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">View Mode</span>
        </div>
        <div className="flex space-x-1 bg-gray-700 rounded-lg p-1">
          <button
            onClick={handleWorkspaceSwitch}
            className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
              viewMode === 'workspace'
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <Home className="w-3 h-3" />
              <span>Workspace</span>
            </div>
          </button>
          <button
            onClick={() => {
              setViewMode('project');
              setCurrentFile(null);
            }}
            className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
              viewMode === 'project'
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              <Briefcase className="w-3 h-3" />
              <span>Projects</span>
            </div>
          </button>
        </div>
      </div>

      {viewMode === 'project' && (
        <div className="bg-gray-800 border-b border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Briefcase className="w-4 h-4 text-purple-400" />
              <span className="text-white text-sm font-medium">Projects</span>
              <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">
                {projects?.length || 0}
              </span>
            </div>
            
            {currentProject && (
              <div className="relative">
                <button
                  onClick={() => setShowProjectActions(!showProjectActions)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Project Actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {showProjectActions && (
                  <div className="absolute right-0 top-6 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-10 w-48">
                    <button
                      onClick={() => handleDeleteProject(selectedProjectId)}
                      className="w-full text-left px-3 py-2 text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Project</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {!projects || projects.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-2">
              <p>No projects found</p>
              <p className="text-xs">Create a project to organize your files</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {projects.map((project) => (
                <div
                  key={project._id}
                  className={`flex items-center justify-between p-2 rounded text-sm transition-colors cursor-pointer ${
                    selectedProjectId === project._id
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  onClick={() => handleProjectSelect(project._id)}
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      project.isPublic ? 'bg-green-400' : 'bg-blue-400'
                    }`}></div>
                    <span className="truncate">{project.name}</span>
                    {project.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-medium">
              {viewMode === 'workspace' ? 'Workspace Files' : currentProject ? currentProject.name : 'Project Files'}
            </h3>
            {viewMode === 'workspace' && (
              <p className="text-xs text-purple-400">Files in your personal workspace</p>
            )}
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => {
                setCreateType('file');
                setShowCreateModal(true);
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="New File"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setCreateType('folder');
                setShowCreateModal(true);
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : viewMode === 'project' && !selectedProjectId ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <Briefcase className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Project Selected</h3>
            <p className="text-sm text-center mb-4">
              Select a project from the list above to view its files
            </p>
            {(!projects || projects.length === 0) && (
              <p className="text-xs text-gray-600 text-center">
                You don't have any projects yet. Create one to get started!
              </p>
            )}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
            <FileText className="w-16 h-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No files yet</h3>
            <p className="text-sm text-center mb-4">
              Create your first file to start coding
            </p>
            <button
              onClick={() => {
                setCreateType('file');
                setShowCreateModal(true);
              }}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create File</span>
            </button>
          </div>
        ) : (
          <div className="p-2">
            {filteredFiles.map((file) => (
              <div key={file.id} className="group flex items-center justify-between p-2 hover:bg-gray-700 rounded">
                <div
                  className={`flex items-center space-x-2 cursor-pointer flex-1 ${
                    currentFile && currentFile.id === file.id ? 'text-purple-400' : 'text-gray-300'
                  }`}
                  onClick={() => file.type !== 'folder' && handleFileClick(file)}
                >
                  {getFileIcon(file)}
                  {editingId === file.id ? (
                    <div className="flex items-center space-x-1 flex-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-gray-600 text-white px-2 py-1 rounded text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameFile(file.id);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditName('');
                          }
                        }}
                      />
                      <button
                        onClick={() => handleRenameFile(file.id)}
                        className="p-1 text-green-400 hover:text-green-300"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditName('');
                        }}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 flex-1">
                      <span className={`text-sm truncate ${
                        currentFile && currentFile.id === file.id ? 'text-purple-300 font-medium' : 'text-gray-300'
                      }`}>
                        {file.name}
                      </span>
                      {file.lastModified && (
                        <span className="text-xs text-gray-500 ml-auto">
                          {new Date(file.lastModified).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {editingId !== file.id && (
                  <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(file.id);
                        setEditName(file.name);
                      }}
                      className="p-1 text-gray-400 hover:text-white"
                      title="Rename"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id, file.name);
                      }}
                      className="p-1 text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {filteredFiles.length > 0 && (
        <div className="border-t border-gray-700 p-3 bg-gray-800/50">
          <div className="text-xs text-gray-400 text-center">
            {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
            {searchQuery && ` matching "${searchQuery}"`}
            {viewMode === 'workspace' ? (
              <span className="ml-2">• Workspace Mode</span>
            ) : currentProject ? (
              <span className="ml-2">• {currentProject.isPublic ? 'Public' : 'Private'} Project</span>
            ) : null}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-600 shadow-2xl">
            <h3 className="text-white text-lg font-medium mb-4 flex items-center space-x-2">
              {createType === 'file' ? <File className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
              <span>Create New {createType === 'file' ? 'File' : 'Folder'}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                viewMode === 'workspace' 
                  ? 'bg-purple-600/20 text-purple-300'
                  : 'bg-blue-600/20 text-blue-300'
              }`}>
                {viewMode === 'workspace' ? 'Workspace' : currentProject?.name || 'Project'}
              </span>
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">
                  {createType === 'file' ? 'File' : 'Folder'} Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder={createType === 'file' ? 'filename' : 'foldername'}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateFile();
                    } else if (e.key === 'Escape') {
                      setShowCreateModal(false);
                      setNewName('');
                    }
                  }}
                />
                {createType === 'file' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Extension will be added automatically based on language
                  </p>
                )}
              </div>

              {createType === 'file' && (
                <div>
                  <label className="block text-gray-300 text-sm mb-2">Language</label>
                  <LanguageSelector
                    value={selectedLanguage}
                    onChange={setSelectedLanguage}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewName('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                disabled={!newName.trim()}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Create</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && projectToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 border border-red-600 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-white text-lg font-medium">Delete Project</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete "<span className="font-medium text-white">{projectToDelete.name}</span>"?
              </p>
              <div className="bg-red-900/20 border border-red-700/30 rounded p-3">
                <p className="text-red-300 text-sm font-medium mb-1">This action cannot be undone!</p>
                <p className="text-red-400 text-sm">
                  All files, folders, and chat history will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setProjectToDelete(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProject}
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
                    <span>Delete Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProjectActions && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowProjectActions(false)}
        />
      )}
    </div>
  );
};

export default FileExplorer;