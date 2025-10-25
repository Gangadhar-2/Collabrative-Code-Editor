
import { useEditor } from '../../context/EditorContext';
import { Terminal, XCircle, CheckCircle, Clock, X } from 'lucide-react';

const OutputPanel = () => {
  const { output, isExecuting } = useEditor();

  const getOutputContent = () => {
    if (!output) return '';
    
    if (typeof output === 'string') {
      return output;
    }
    
    if (typeof output === 'object') {
      if (output.error) {
        return typeof output.error === 'string' 
          ? output.error 
          : JSON.stringify(output.error, null, 2);
      }
      
      if (output.output !== undefined) {
        return typeof output.output === 'string'
          ? output.output
          : JSON.stringify(output.output, null, 2);
      }
      
      return JSON.stringify(output, null, 2);
    }
    
    return String(output);
  };

  const hasError = () => {
    if (!output) return false;
    
    if (typeof output === 'object') {
      return output.error !== null && output.error !== undefined && output.error !== '';
    }
    
    return false;
  };

  const getExecutionTime = () => {
    if (!output || typeof output !== 'object') return null;
    return output.executionTime || null;
  };

  const getExitCode = () => {
    if (!output || typeof output !== 'object') return null;
    return output.exitCode !== undefined ? output.exitCode : null;
  };

  const outputContent = getOutputContent();
  const isError = hasError();
  const executionTime = getExecutionTime();
  const exitCode = getExitCode();

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium">Output</span>
          
          {isExecuting && (
            <div className="flex items-center space-x-2 ml-4">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-yellow-400">Executing...</span>
            </div>
          )}
          
          {!isExecuting && outputContent && (
            <div className="flex items-center space-x-2 ml-4">
              {isError ? (
                <>
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400">Error</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">Success</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 text-xs text-gray-400">
          {executionTime !== null && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{executionTime}ms</span>
            </div>
          )}
          
          {exitCode !== null && (
            <div className="flex items-center space-x-1">
              <span className={exitCode === 0 ? 'text-green-400' : 'text-red-400'}>
                Exit: {exitCode}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {isExecuting ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin mb-4"></div>
            <p>Executing code...</p>
          </div>
        ) : outputContent ? (
          <pre className={`whitespace-pre-wrap break-words ${isError ? 'text-red-400' : 'text-gray-300'}`}>
            {outputContent}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Terminal className="w-12 h-12 mb-4 opacity-50" />
            <p>No output yet</p>
            <p className="text-xs mt-2">Run your code to see the output here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputPanel;