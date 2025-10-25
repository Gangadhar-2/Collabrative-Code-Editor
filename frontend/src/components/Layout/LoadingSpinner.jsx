
import { Code } from 'lucide-react';

const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Code className="w-8 h-8 text-white" />
        </div>
        <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg font-medium">{message}</p>
        <p className="text-purple-200 text-sm mt-2">Please wait while we set things up</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;