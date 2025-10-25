import React, { useState } from 'react';
import { X, Code, Sparkles, Globe } from 'lucide-react';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';

const ProjectModal = ({ isOpen, onClose, onProjectCreated, roomId }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    primaryLanguage: 'javascript',
    projectType: 'web',
    framework: 'none',
    isPublic: true
  });
  const [loading, setLoading] = useState(false);

  const languages = [
    { id: 'javascript', name: 'JavaScript', icon: '🟨' },
    { id: 'typescript', name: 'TypeScript', icon: '🔷' },
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'cpp', name: 'C++', icon: '⚡' },
    { id: 'c', name: 'C', icon: '🔧' }
  ];

  const projectTypes = [
    { id: 'web', name: 'Web Application', description: 'Frontend/Full-stack web projects' },
    { id: 'backend', name: 'Backend API', description: 'Server-side applications' },
    { id: 'desktop', name: 'Desktop App', description: 'Desktop applications' },
    { id: 'mobile', name: 'Mobile App', description: 'Mobile applications' }
  ];

  const frameworks = {
    javascript: [
      { id: 'none', name: 'Vanilla JavaScript' },
      { id: 'react', name: 'React' },
      { id: 'vue', name: 'Vue.js' },
      { id: 'angular', name: 'Angular' },
      { id: 'node', name: 'Node.js' },
      { id: 'express', name: 'Express.js' }
    ],
    typescript: [
      { id: 'none', name: 'Vanilla TypeScript' },
      { id: 'react', name: 'React + TypeScript' },
      { id: 'vue', name: 'Vue.js + TypeScript' },
      { id: 'angular', name: 'Angular' },
      { id: 'node', name: 'Node.js + TypeScript' }
    ],
    python: [
      { id: 'none', name: 'Pure Python' },
      { id: 'django', name: 'Django' },
      { id: 'flask', name: 'Flask' },
      { id: 'fastapi', name: 'FastAPI' },
      { id: 'streamlit', name: 'Streamlit' }
    ],
    java: [
      { id: 'none', name: 'Core Java' },
      { id: 'spring', name: 'Spring Boot' },
      { id: 'android', name: 'Android' }
    ],
    cpp: [
      { id: 'none', name: 'Standard C++' },
      { id: 'qt', name: 'Qt Framework' }
    ],
    c: [
      { id: 'none', name: 'Standard C' }
    ]
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'primaryLanguage') {
      setFormData(prev => ({
        ...prev,
        framework: 'none'
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showToast('Project name is required', 'error');
      return;
    }

    if (!roomId) {
      showToast('No active room found. Please join a room first.', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const response = await apiService.createProject({
        ...formData,
        programmingLanguage: formData.primaryLanguage,
        isPublic: true
      }, roomId);
      
      if (response.success) {
        showToast('Project created successfully!', 'success');
        onProjectCreated(response.data.project);
        onClose();
        
        setFormData({
          name: '',
          description: '',
          primaryLanguage: 'javascript',
          projectType: 'web',
          framework: 'none',
          isPublic: true
        });
      } else {
        showToast(response.message || 'Failed to create project', 'error');
      }
    } catch (error) {
      console.error('Project creation error:', error);
      showToast(error.response?.data?.message || 'Failed to create project', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'info') => {
    const toastId = toast[type](message, {
      duration: 3000,
      position: 'top-right'
    });
    setTimeout(() => toast.dismiss(toastId), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create New Project</h2>
              <p className="text-gray-400 text-sm">
                Creating in room: {roomId ? `#${roomId}` : 'No room selected'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Project Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              placeholder="My Awesome Project"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors resize-none"
              placeholder="Describe your project..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Primary Language
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {languages.map((language) => (
                <label
                  key={language.id}
                  className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.primaryLanguage === language.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="primaryLanguage"
                    value={language.id}
                    checked={formData.primaryLanguage === language.id}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="text-lg">{language.icon}</span>
                  <span className="text-white text-sm font-medium">{language.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Framework / Library
            </label>
            <select
              name="framework"
              value={formData.framework}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer hover:border-gray-500 transition-colors"
              style={{
                backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
              }}
            >
              {frameworks[formData.primaryLanguage]?.map((framework) => (
                <option 
                  key={framework.id} 
                  value={framework.id}
                  className="bg-gray-800 text-white py-2"
                >
                  {framework.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Project Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projectTypes.map((type) => (
                <label
                  key={type.id}
                  className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.projectType === type.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="projectType"
                    value={type.id}
                    checked={formData.projectType === type.id}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="text-white font-medium">{type.name}</span>
                  <span className="text-gray-400 text-xs mt-1">{type.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Globe className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-blue-300 font-semibold mb-1">Shared Project</h4>
                <p className="text-blue-100 text-sm">
                  This project will be visible to all users in room #{roomId}. Everyone in this room can view, edit, and collaborate on files together.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim() || !roomId}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Code className="w-4 h-4" />
                  <span>Create Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;