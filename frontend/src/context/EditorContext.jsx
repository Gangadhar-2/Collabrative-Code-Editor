import React, { createContext, useContext, useReducer, useCallback } from 'react';

const EditorContext = createContext();

const filesMatch = (file1, file2) => {
  if (!file1 || !file2) return false;
  const id1 = file1.id || file1._id;
  const id2 = file2.id || file2._id;
  return id1 && id2 && id1 === id2;
};

const fileMatchesId = (file, fileId) => {
  if (!file || !fileId) return false;
  return file.id === fileId || file._id === fileId;
};

const editorReducer = (state, action) => {
  switch (action.type) {
    case 'SET_FILES':
      console.log('EditorContext: SET_FILES', action.payload?.length || 0, 'files');
      return { ...state, files: action.payload };
      
    case 'ADD_FILE': {
      const newFile = action.payload;
      console.log('EditorContext: ADD_FILE', newFile.name);
      
      const exists = state.files.some(f => filesMatch(f, newFile));
      
      if (exists) {
        console.log('EditorContext: File already exists, skipping');
        return state;
      }
      
      return { ...state, files: [...state.files, newFile] };
    }
      
    case 'UPDATE_FILE': {
      const updatedFile = action.payload;
      console.log('EditorContext: UPDATE_FILE', updatedFile.id || updatedFile._id);
      
      return {
        ...state,
        files: state.files.map(file =>
          filesMatch(file, updatedFile) ? { ...file, ...updatedFile } : file
        ),
        currentFile: filesMatch(state.currentFile, updatedFile)
          ? { ...state.currentFile, ...updatedFile }
          : state.currentFile
      };
    }
      
    case 'DELETE_FILE': {
      const fileId = action.payload;
      console.log('EditorContext: DELETE_FILE', fileId);
      
      const updatedFiles = state.files.filter(file => !fileMatchesId(file, fileId));
      
      return {
        ...state,
        files: updatedFiles,
        currentFile: fileMatchesId(state.currentFile, fileId) ? null : state.currentFile
      };
    }
      
    case 'SET_CURRENT_FILE':
      console.log('EditorContext: SET_CURRENT_FILE', action.payload?.name || 'null');
      return { ...state, currentFile: action.payload };
      
    case 'SET_OUTPUT':
      return { ...state, output: action.payload };
      
    case 'SET_EXECUTING':
      return { ...state, isExecuting: action.payload };
      
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
      
    case 'CLEAR_OUTPUT':
      return { ...state, output: '', isExecuting: false };
      
    case 'SET_PROJECT_ID':
      return { ...state, currentProjectId: action.payload };
      
    case 'SET_ROOM_ID':
      return { ...state, currentRoomId: action.payload };
      
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'CLEAR_ALL':
      console.log('EditorContext: CLEAR_ALL');
      return {
        ...initialState,
        language: state.language 
      };
      
    default:
      return state;
  }
};

const initialState = {
  files: [],
  currentFile: null,
  output: '',
  isExecuting: false,
  language: 'javascript',
  currentProjectId: null,
  currentRoomId: null,
  loading: false,
  error: null
};

export const EditorProvider = ({ children }) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  const setFiles = useCallback((files) => {
    console.log('EditorContext: setFiles called with', files?.length || 0, 'files');
    dispatch({ type: 'SET_FILES', payload: files });
  }, []);

  const addFile = useCallback((file) => {
    console.log('EditorContext: addFile called', file?.name);
    dispatch({ type: 'ADD_FILE', payload: file });
  }, []);

  const updateFile = useCallback((file) => {
    console.log('EditorContext: updateFile called', file?.id || file?._id);
    dispatch({ type: 'UPDATE_FILE', payload: file });
  }, []);

  const deleteFile = useCallback((fileId) => {
    console.log('EditorContext: deleteFile called', fileId);
    dispatch({ type: 'DELETE_FILE', payload: fileId });
  }, []);

  const setCurrentFile = useCallback((file) => {
    console.log('EditorContext: setCurrentFile called', file?.name || 'null');
    dispatch({ type: 'SET_CURRENT_FILE', payload: file });
  }, []);

  const setOutput = useCallback((output) => {
    dispatch({ type: 'SET_OUTPUT', payload: output });
  }, []);

  const setExecuting = useCallback((isExecuting) => {
    dispatch({ type: 'SET_EXECUTING', payload: isExecuting });
  }, []);

  const setLanguage = useCallback((language) => {
    dispatch({ type: 'SET_LANGUAGE', payload: language });
  }, []);

  const clearOutput = useCallback(() => {
    dispatch({ type: 'CLEAR_OUTPUT' });
  }, []);

  const setProjectId = useCallback((projectId) => {
    dispatch({ type: 'SET_PROJECT_ID', payload: projectId });
  }, []);

  const setRoomId = useCallback((roomId) => {
    dispatch({ type: 'SET_ROOM_ID', payload: roomId });
  }, []);

  const setLoading = useCallback((loading) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearAll = useCallback(() => {
    console.log('EditorContext: clearAll called');
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const getFileById = useCallback((fileId) => {
    return state.files.find(file => fileMatchesId(file, fileId)) || null;
  }, [state.files]);

  const getFilesByType = useCallback((type) => {
    return state.files.filter(file => file.type === type);
  }, [state.files]);

  const getFilesByLanguage = useCallback((language) => {
    return state.files.filter(file => file.language === language);
  }, [state.files]);

  const hasUnsavedChanges = useCallback(() => {
    return false;
  }, []);

  const value = {
    ...state,
    
    setFiles,
    addFile,
    updateFile,
    deleteFile,
    setCurrentFile,
    setOutput,
    setExecuting,
    setLanguage,
    clearOutput,
    setProjectId,
    setRoomId,
    setLoading,
    setError,
    clearAll,
    
    getFileById,
    getFilesByType,
    getFilesByLanguage,
    hasUnsavedChanges
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

export { EditorContext };

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};