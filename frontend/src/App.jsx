import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { EditorProvider } from './context/EditorContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import ErrorBoundary from './components/Layout/ErrorBoundary';
import LoginPage from './components/Auth/LoginPage';
import HomePage from './pages/HomePage';
import EditorPage from './pages/EditorPage';

import './styles/editor.css';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <EditorProvider>
            <Router>
              <div className="App">
                <Routes>
                
                  <Route path="/auth" element={<LoginPage />} />
                  
                  <Route 
                    path="/" 
                    element={
                      <ProtectedRoute>
                        <HomePage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  <Route 
                    path="/editor/:roomId" 
                    element={
                      <ProtectedRoute>
                        <EditorPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  <Route path="/project/:projectId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
                  
              
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>

              
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: 'rgba(17, 24, 39, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(75, 85, 99, 0.3)',
                      color: 'white',
                      zIndex: 9999
                    },
                    success: {
                      iconTheme: {
                        primary: '#10b981',
                        secondary: 'white',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: 'white',
                      },
                    },
                  }}
                />
              </div>
            </Router>
          </EditorProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;