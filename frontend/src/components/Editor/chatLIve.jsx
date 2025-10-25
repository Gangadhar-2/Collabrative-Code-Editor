import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useEditor } from '../context/EditorContext';
import { Activity, Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const DiagnosticPanel = ({ roomId }) => {
  const { socket, connected, participants } = useSocket();
  const { currentFile } = useEditor();
  const [events, setEvents] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const logEvent = (type, data) => {
      const event = {
        type,
        data,
        timestamp: new Date().toISOString()
      };
      setEvents(prev => [event, ...prev].slice(0, 50)); 
    };

    socket.onAny((eventName, ...args) => {
      logEvent(eventName, args[0]);
    });

    return () => {
      socket.offAny();
    };
  }, [socket]);

  const getEventIcon = (type) => {
    if (type.includes('error')) return <XCircle className="w-4 h-4 text-red-500" />;
    if (type.includes('success') || type.includes('joined')) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (type.includes('code') || type.includes('file')) return <Activity className="w-4 h-4 text-blue-500" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  const formatEventData = (data) => {
    if (!data) return 'No data';
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-50 p-3 bg-gray-800 hover:bg-gray-700 rounded-full shadow-lg border-2 border-gray-600 transition-all"
        title="Open Diagnostics"
      >
        <Activity className="w-5 h-5 text-blue-400" />
      </button>

      {isOpen && (
        <div className="fixed bottom-32 right-4 z-50 w-96 h-96 bg-gray-900 border-2 border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-800 p-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-semibold">Live Sync Diagnostics</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="bg-gray-800/50 p-3 border-b border-gray-700 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Socket Connection:</span>
              <div className="flex items-center space-x-2">
                {connected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Room ID:</span>
              <span className="text-white font-mono text-xs">{roomId || 'None'}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Current File:</span>
              <span className="text-white text-xs">{currentFile?.name || 'None'}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Participants:</span>
              <span className="text-white">{participants.length}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Socket ID:</span>
              <span className="text-white font-mono text-xs">{socket?.id || 'N/A'}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-gray-400 text-sm font-medium">Event Log</h4>
              <button
                onClick={() => setEvents([])}
                className="text-xs text-gray-500 hover:text-white"
              >
                Clear
              </button>
            </div>

            {events.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No events yet. Start coding to see live sync activity.
              </div>
            ) : (
              events.map((event, index) => (
                <div
                  key={index}
                  className="bg-gray-800 rounded p-2 border border-gray-700"
                >
                  <div className="flex items-start space-x-2">
                    {getEventIcon(event.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-medium">{event.type}</span>
                        <span className="text-gray-500 text-xs">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-gray-400 text-xs mt-1 overflow-x-auto">
                        {formatEventData(event.data).substring(0, 200)}
                        {formatEventData(event.data).length > 200 && '...'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-gray-800 p-2 border-t border-gray-700 text-center">
            <p className="text-xs text-gray-500">
              Real-time event monitoring • {events.length} events logged
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default DiagnosticPanel;