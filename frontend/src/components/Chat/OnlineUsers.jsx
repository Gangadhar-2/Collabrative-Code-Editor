import React from 'react';
import { Users, Crown, Circle, X } from 'lucide-react';

const OnlineUsers = ({ participants = [], onClose }) => {
  return (
    <div className="h-full bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-green-400" />
          <span className="text-white font-medium">
            Online Users ({participants.length})
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-3 space-y-2 overflow-y-auto max-h-full">
        {participants.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No users online</p>
            <p className="text-sm">Waiting for collaborators...</p>
          </div>
        ) : (
          participants.map((participant, index) => {
            const username = 
              participant.user?.username || 
              participant.username || 
              participant.user?.name ||
              participant.name ||
              'Unknown User';
            
            const isOwner = participant.isOwner || participant.role === 'owner';
            
            if (username === 'Unknown User') {
              console.log('🔍 Unknown user participant:', participant);
            }
            
            return (
              <div
                key={participant.user?.id || participant.id || index}
                className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors border border-gray-700/50"
              >
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    isOwner ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'
                  }`}>
                    {username.charAt(0).toUpperCase()}
                  </div>

                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-gray-900 rounded-full flex items-center justify-center">
                    <Circle className="w-2 h-2 fill-current" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-white text-sm font-medium truncate">
                      {username}
                    </span>
                    {isOwner && (
                      <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" title="Room Owner" />
                    )}
                  </div>
                  <div className="flex items-center space-x-1 mt-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-400 font-medium">Active now</span>
                  </div>
                </div>

                <div className="flex flex-col items-end text-xs">
                  <span className="text-gray-400">
                    {participant.joinedAt ? 'Joined' : 'Active'}
                  </span>
                  {participant.joinedAt && (
                    <span className="text-gray-500">
                      {new Date(participant.joinedAt).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {participants.length > 0 && (
        <div className="border-t border-gray-700 p-3 bg-gray-800/50">
          <div className="text-center">
            <p className="text-xs text-gray-400">
              {participants.length} {participants.length === 1 ? 'person' : 'people'} actively coding
            </p>
            <div className="flex justify-center space-x-1 mt-2">
              {participants.slice(0, 5).map((participant, index) => {
                const username = 
                  participant.user?.username || 
                  participant.username || 
                  'U';
                
                return (
                  <div
                    key={participant.user?.id || participant.id || index}
                    className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-xs text-white font-bold"
                    title={username}
                  >
                    {username.charAt(0).toUpperCase()}
                  </div>
                );
              })}
              {participants.length > 5 && (
                <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs text-white">
                  +{participants.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineUsers;