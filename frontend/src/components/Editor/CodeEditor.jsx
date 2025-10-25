import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEditor } from '../../context/EditorContext';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { 
  Download, 
  Copy, 
  Check,
  FileCode,
  FolderPlus,
  FilePlus
} from 'lucide-react';
import toast from 'react-hot-toast';

const CodeEditor = ({ roomId, projectId }) => {
  const { currentFile, updateFile, setCurrentFile } = useEditor();
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const editorRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const lastSyncRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const isUpdatingFromRemoteRef = useRef(false);

  console.log('🔍 CodeEditor render:', { currentFile: currentFile?.name, roomId, projectId });

  useEffect(() => {
    if (!currentFile && editorRef.current) {
      console.log('📄 No file selected, clearing editor');
      editorRef.current.setValue('');
    }
  }, [currentFile]);

  useEffect(() => {
    if (!socket || !connected || !currentFile || !user) {
      console.log('⏳ Not ready for code sync:', {
        hasSocket: !!socket,
        connected,
        hasFile: !!currentFile,
        hasUser: !!user
      });
      return;
    }

    console.log('🔌 Setting up code sync listener:', {
      file: currentFile.name,
      fileId: currentFile.id,
      userId: user._id,
      projectId,
      roomId
    });

    const handleCodeUpdate = (data) => {
      console.log('📥 RECEIVE: code-updated', {
        fileId: data.fileId,
        currentFileId: currentFile?.id,
        fromUserId: data.user?.id,
        myUserId: user?._id,
        fromUser: data.user?.username,
        contentLength: data.content?.length
      });
    
      const incomingUserId = data.user?.id?.toString();
      const myUserId = user?._id?.toString();
      
      console.log('🔍 User ID comparison:', {
        incoming: incomingUserId,
        mine: myUserId,
        match: incomingUserId === myUserId
      });

      if (incomingUserId === myUserId) {
        console.log('⏭️ Ignoring - OWN change detected');
        return;
      }

      if (data.fileId !== currentFile?.id) {
        console.log('⏭️ Ignoring - different file');
        return;
      }

      console.log('🔔 CODE UPDATE RECEIVED from:', data.user?.username);
      
      if (editorRef.current && data.content !== undefined) {
        isUpdatingFromRemoteRef.current = true;
        
        const currentPosition = editorRef.current.getPosition();
        console.log('✅ APPLYING REMOTE UPDATE from:', data.user?.username);
        editorRef.current.setValue(data.content);
        if (currentPosition) {
          editorRef.current.setPosition(currentPosition);
        }
        
        updateFile({ id: currentFile.id, content: data.content });
        console.log('✅ Editor updated from remote');
        
        setTimeout(() => {
          isUpdatingFromRemoteRef.current = false;
        }, 100);
      }
    };

    socket.on('code-updated', handleCodeUpdate);
    console.log('✅ Code sync listeners registered for:', currentFile.name);

    return () => {
      socket.off('code-updated', handleCodeUpdate);
      console.log('🧹 Code sync listener removed for:', currentFile.name);
    };
  }, [socket, connected, currentFile, user, projectId, roomId, updateFile]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    console.log('✅ Editor mounted');
  };

  const handleEditorChange = (value) => {
    if (isUpdatingFromRemoteRef.current) {
      console.log('⏭️ Skipping - change from remote update');
      return;
    }

    if (!currentFile) {
      console.log('⏭️ No file selected, ignoring change');
      return;
    }

    console.log('📝 Local change, length:', value?.length);
    
    updateFile({ id: currentFile.id, content: value });

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      if (socket && connected && value !== lastSyncRef.current) {
        console.log('📡 Broadcasting code change:', {
          fileId: currentFile.id,
          contentLength: value?.length,
          roomId,
          projectId,
          userId: user._id
        });

        socket.emit('code-change', {
          fileId: currentFile.id,
          content: value,
          language: currentFile.language || 'javascript',
          roomId: roomId,
          projectId: projectId,
          user: {
            id: user._id,
            username: user.username
          }
        });

        lastSyncRef.current = value;
        console.log('📤 Code change emitted');
      }
    }, 300);
  };

  const handleDownloadFile = () => {
    if (!currentFile) {
      toast.error('No file selected');
      return;
    }

    const blob = new Blob([currentFile.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  const handleCopyCode = () => {
    if (!currentFile) {
      toast.error('No file selected');
      return;
    }

    navigator.clipboard.writeText(currentFile.content || '');
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!currentFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center space-y-6 max-w-md px-8">
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center">
              <FileCode className="w-12 h-12 text-purple-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">
              No File Selected
            </h2>
            <p className="text-gray-500">
              Create or select a file from the file explorer to start coding
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex items-center space-x-2 text-sm">
              <FilePlus className="w-4 h-4 text-green-400" />
              <span className="text-gray-400">
                Click <span className="text-white font-medium">+ New File</span> in the file explorer
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <FolderPlus className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">
                Or create a <span className="text-white font-medium">New Project</span> to organize your files
              </span>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              💡 Tip: All changes are automatically synced with your collaborators in real-time
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <FileCode className="w-4 h-4 text-purple-400" />
          <span className="text-white font-medium text-sm">
            {currentFile.name}
          </span>
          <span className="text-xs text-gray-500">
            {currentFile.language || 'text'}
          </span>
          {connected && (
            <span className="flex items-center space-x-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span>Live</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyCode}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Copy Code"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleDownloadFile}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Download File"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={currentFile.language || 'javascript'}
          value={currentFile.content || ''}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            quickSuggestions: true,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;